import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
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
import { Message, MessageDocument } from './schemas/message.schema';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
    methods: ['GET', 'POST'],
    credentials: false,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  private readonly userSockets: Map<string, Socket> = new Map();

  public constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>
  ) { }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.disconnectClient(client, 'Missing token');
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);

      const userId = new Types.ObjectId(payload.sub);

      if (!userId) {
        this.disconnectClient(client, 'JWT payload missing sub');
        return;
      }

      const couple = await this.coupleModel.findOne({
        $or: [{ user_1: userId }, { user_2: userId }],
        status: CoupleStatus.ACTIVE,
      });

      if (!couple) {
        this.disconnectClient(client, `No active couple for user ${userId}`);
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

      this.userSockets.set(userId.toString(), client);

      client.data.userId = userId;
      client.join(`users:${userId}`);

      client.join(`conversations:${conversation._id.toString()}`);
      this.logger.log(`Client ${client.id} connected as user ${userId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.disconnectClient(client, `Connection failed: ${message}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.userSockets.delete(userId);
    }
  }

  checkUserConnection(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  sendMassageToConversation(conversationId: string, message: Message) {
    this.server
      .to(`conversations:${conversationId}`)
      .emit('message:new', message);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    const queryToken = client.handshake.query?.token;
    const authorization = client.handshake.headers.authorization;
    const rawToken = Array.isArray(queryToken) ? queryToken[0] : authToken ?? queryToken;

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
