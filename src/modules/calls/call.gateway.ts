import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  AuthSessionService,
  SessionJwtPayload,
} from '../auth/auth-session.service';

@WebSocketGateway({
  namespace: '/calls',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly socketUsers = new Map<string, string>();

  public constructor(
    private readonly jwtService: JwtService,
    private readonly authSessionService: AuthSessionService,
  ) {}

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
      client.emit('calls:ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      client.emit('calls:error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    this.socketUsers.delete(client.id);
    if (userId) {
      this.authSessionService.unregisterSocket(userId, client);
    }
  }

  @SubscribeMessage('calls:ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('calls:pong');
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  private userRoom(userId: string) {
    return `users:${userId}`;
  }

  private extractToken(client: Socket): string | undefined {
    const queryToken = client.handshake.query?.token;
    const authorization = client.handshake.headers.authorization;
    const handshakeAuth = client.handshake.auth as Record<string, unknown>;
    const authToken = handshakeAuth.token;
    const rawToken =
      authToken ??
      (Array.isArray(queryToken) ? queryToken[0] : queryToken) ??
      authorization;

    return typeof rawToken === 'string'
      ? rawToken.replace(/^Bearer\s+/i, '').trim()
      : undefined;
  }
}
