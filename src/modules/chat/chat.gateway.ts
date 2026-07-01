import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { CoupleStatus } from '../couples/enum/couple-status.enum';

import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: false,
  },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  public constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.disconnectClient(client, 'Missing token');
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(
        token,
      );
      if (!payload.sub || !Types.ObjectId.isValid(payload.sub)) {
        this.disconnectClient(client, 'JWT payload missing sub');
        return;
      }
      const userId = new Types.ObjectId(payload.sub);

      const couple = await this.coupleModel.findOne({
        $or: [{ user_1: userId }, { user_2: userId }],
        status: CoupleStatus.ACTIVE,
      });

      if (!couple) {
        this.disconnectClient(
          client,
          `No active couple for user ${userId.toString()}`,
        );
        return;
      }

      let conversation = await this.conversationModel.findOne({
        couple: couple._id,
      });

      if (!conversation) {
        conversation = await this.conversationModel.create({
          couple: couple._id,
        });
      }

      await client.join(`users:${userId.toString()}`);
      await client.join(`conversations:${conversation._id.toString()}`);
      this.logger.log(
        `Client ${client.id} connected as user ${userId.toString()}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.disconnectClient(client, `Connection failed: ${message}`);
    }
  }

  sendMessageToConversation(conversationId: string, message: unknown) {
    this.server
      .to(`conversations:${conversationId}`)
      .emit('message:new', message);
  }

  sendTimelineEvent(conversationId: string, event: string, item: unknown) {
    this.server.to(`conversations:${conversationId}`).emit(event, item);
  }

  private extractToken(client: Socket): string | undefined {
    const handshakeAuth = client.handshake.auth as Record<string, unknown>;
    const authToken = handshakeAuth.token;
    const queryToken = client.handshake.query?.token;
    const authorization = client.handshake.headers.authorization;
    const rawToken = Array.isArray(queryToken)
      ? queryToken[0]
      : (authToken ?? queryToken);

    if (typeof rawToken === 'string' && rawToken.trim()) {
      return this.normalizeBearerToken(rawToken);
    }

    if (typeof authorization === 'string' && authorization.trim()) {
      return this.normalizeBearerToken(authorization);
    }

    return undefined;
  }

  private normalizeBearerToken(token: string): string {
    return token.replace(/^Bearer\s+/i, '').trim();
  }

  private disconnectClient(client: Socket, reason: string) {
    this.logger.warn(`Disconnecting client ${client.id}: ${reason}`);
    client.emit('chat:error', { message: reason });
    client.disconnect(true);
  }
}
