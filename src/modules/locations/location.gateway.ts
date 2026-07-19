import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { UpdateLiveLocationDto } from './dto/update-live-location.dto';
import { LocationRealtimeService } from './location-realtime.service';
import { LocationService } from './location.service';
import { PresenceService } from '../presence/presence.service';
import {
  AuthSessionService,
  SessionJwtPayload,
} from '../auth/auth-session.service';

type LocationUpdateAck = (response: {
  ok: boolean;
  location?: unknown;
  code?: string;
  message?: string;
}) => void;

@WebSocketGateway({
  namespace: '/locations',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class LocationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(LocationGateway.name);

  @WebSocketServer()
  server: Server;

  private readonly socketUsers = new Map<string, string>();
  private readonly lastUpdateAtByUser = new Map<string, number>();

  public constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly locationService: LocationService,
    private readonly locationRealtime: LocationRealtimeService,
    private readonly presenceService: PresenceService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  afterInit(server: Server) {
    this.locationRealtime.bindServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing token');
      }

      const payload =
        await this.jwtService.verifyAsync<SessionJwtPayload>(token);
      const session = await this.authSessionService.validatePayload(payload);

      await client.join(this.userRoom(session.userId));
      this.socketUsers.set(client.id, session.userId);
      this.authSessionService.registerSocket(
        session.userId,
        session.sessionId,
        client,
      );
      this.presenceService.registerConnection(
        session.userId,
        `locations:${client.id}`,
      );
      client.emit('locations:ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      this.logger.warn(`Disconnecting location socket: ${message}`);
      client.emit('locations:error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    this.socketUsers.delete(client.id);
    if (userId) {
      this.authSessionService.unregisterSocket(userId, client);
      this.presenceService.unregisterConnection(
        userId,
        `locations:${client.id}`,
      );
    }
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
    @Ack() ack?: LocationUpdateAck,
  ) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) {
      return this.respond(client, ack, {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Socket is not authenticated',
      });
    }

    const dto = plainToInstance(
      UpdateLiveLocationDto,
      typeof body === 'object' && body !== null ? body : {},
    );
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      return this.respond(client, ack, {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid location update',
      });
    }

    const now = Date.now();
    const lastUpdateAt = this.lastUpdateAtByUser.get(userId) ?? 0;
    if (now - lastUpdateAt < this.updateMinIntervalMs) {
      return this.respond(client, ack, {
        ok: false,
        code: 'RATE_LIMITED',
        message: 'Location updates are too frequent',
      });
    }
    this.lastUpdateAtByUser.set(userId, now);

    try {
      const location = await this.locationService.updateSharing(userId, dto);
      return this.respond(client, ack, { ok: true, location });
    } catch (error) {
      return this.respond(client, ack, {
        ok: false,
        code:
          error instanceof ConflictException
            ? 'LIVE_SHARING_NOT_ACTIVE'
            : error instanceof BadRequestException
              ? 'INVALID_LOCATION_TIMESTAMP'
              : 'LOCATION_UPDATE_FAILED',
        message:
          error instanceof Error ? error.message : 'Could not update location',
      });
    }
  }

  private userRoom(userId: string) {
    return `users:${userId}`;
  }

  private respond(
    client: Socket,
    ack: LocationUpdateAck | undefined,
    response: Parameters<LocationUpdateAck>[0],
  ) {
    if (ack) {
      ack(response);
    } else {
      client.emit('location:update-ack', response);
    }
    return response;
  }

  private get updateMinIntervalMs() {
    const configured = Number(
      this.configService.get<string>('LOCATION_UPDATE_MIN_INTERVAL_MS'),
    );
    return Number.isFinite(configured) && configured >= 250 ? configured : 1000;
  }

  private extractToken(client: Socket): string | undefined {
    const handshakeAuth = client.handshake.auth as Record<string, unknown>;
    const queryToken = client.handshake.query?.token;
    const rawToken =
      handshakeAuth.token ??
      (Array.isArray(queryToken) ? queryToken[0] : queryToken) ??
      client.handshake.headers.authorization;

    return typeof rawToken === 'string'
      ? rawToken.replace(/^Bearer\s+/i, '').trim()
      : undefined;
  }
}
