import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/calls',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CallGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  public constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing token');
      }

      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(
        token,
      );
      if (!payload.sub) {
        throw new Error('JWT payload missing sub');
      }

      await client.join(this.userRoom(String(payload.sub)));
      client.emit('calls:ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      client.emit('calls:error', { message });
      client.disconnect(true);
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
