import {
  OnGatewayConnection,
  OnGatewayDisconnect,
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
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { PresencePayload, PresenceService } from '../presence/presence.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: false,
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  private readonly socketUsers = new Map<string, string>();
  private readonly unsubscribePresence: () => boolean;

  public constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly presenceService: PresenceService,
  ) {
    this.unsubscribePresence = this.presenceService.subscribe(
      (userId, payload) => this.broadcastPresenceToPartner(userId, payload),
    );
  }

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
      this.socketUsers.set(client.id, userId.toString());
      this.presenceService.registerConnection(
        userId.toString(),
        `chat:${client.id}`,
      );
      const partnerId = couple.user_1.equals(userId)
        ? couple.user_2
        : couple.user_1;
      client.emit('chat:ready', {
        partnerPresence: this.presenceService.getPresence(partnerId.toString()),
      });
      this.logger.log(
        `Client ${client.id} connected as user ${userId.toString()}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.disconnectClient(client, `Connection failed: ${message}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (!userId) {
      return;
    }
    this.socketUsers.delete(client.id);
    this.presenceService.unregisterConnection(userId, `chat:${client.id}`);
  }

  onModuleDestroy() {
    this.unsubscribePresence();
  }

  sendMessageToConversation(conversationId: string, message: unknown) {
    this.server
      .to(`conversations:${conversationId}`)
      .emit('message:new', message);
  }

  sendTimelineEvent(conversationId: string, event: string, item: unknown) {
    this.server.to(`conversations:${conversationId}`).emit(event, item);
  }

  private async broadcastPresenceToPartner(
    userId: string,
    payload: PresencePayload,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      return;
    }
    const userObjectId = new Types.ObjectId(userId);
    const couple = await this.coupleModel.findOne({
      $or: [{ user_1: userObjectId }, { user_2: userObjectId }],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      return;
    }
    const partnerId = couple.user_1.equals(userObjectId)
      ? couple.user_2
      : couple.user_1;
    this.server
      .to(`users:${partnerId.toString()}`)
      .emit('presence:partner-updated', payload);
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
