import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { Socket } from 'socket.io';
import { UserStatus } from '../users/enum/user-role.enum';
import { User } from '../users/schemas/user.schema';

export type SessionJwtPayload = {
  sub?: string;
  email?: string;
  sid?: string;
};

type RegisteredSocket = {
  sessionId: string;
  socket: Socket;
};

@Injectable()
export class AuthSessionService {
  private readonly socketsByUser = new Map<
    string,
    Map<string, RegisteredSocket>
  >();

  public constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async startSession(userId: string) {
    const sessionId = randomUUID();
    const previousUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            activeSessionId: sessionId,
            lastLoginAt: new Date(),
          },
        },
        { new: false },
      )
      .select('+activeSessionId');
    if (!previousUser) {
      throw new UnauthorizedException('User not found');
    }

    if (
      previousUser.activeSessionId &&
      previousUser.activeSessionId !== sessionId
    ) {
      this.disconnectSessionSockets(userId, previousUser.activeSessionId);
    }
    return sessionId;
  }

  async validatePayload(payload: SessionJwtPayload) {
    if (!payload.sub || !payload.sid || !Types.ObjectId.isValid(payload.sub)) {
      throw new UnauthorizedException('Invalid authentication session');
    }
    const user = await this.userModel
      .findOne({
        _id: payload.sub,
        activeSessionId: payload.sid,
        status: UserStatus.ACTIVE,
      })
      .select('+activeSessionId');
    if (!user) {
      throw new UnauthorizedException(
        'Session expired or signed in on another device',
      );
    }
    return {
      user,
      userId: user._id.toString(),
      sessionId: payload.sid,
    };
  }

  registerSocket(userId: string, sessionId: string, socket: Socket) {
    let sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      sockets = new Map();
      this.socketsByUser.set(userId, sockets);
    }
    sockets.set(this.socketKey(socket), { sessionId, socket });
  }

  unregisterSocket(userId: string, socket: Socket) {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      return;
    }
    sockets.delete(this.socketKey(socket));
    if (sockets.size === 0) {
      this.socketsByUser.delete(userId);
    }
  }

  async logout(userId: string, sessionId: string) {
    const result = await this.userModel.updateOne(
      { _id: userId, activeSessionId: sessionId },
      { $unset: { activeSessionId: 1 } },
    );
    if (result.modifiedCount > 0) {
      this.disconnectSessionSockets(userId, sessionId);
    }
    return { loggedOut: true };
  }

  private disconnectSessionSockets(userId: string, sessionId: string) {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      return;
    }
    for (const [key, registration] of sockets) {
      if (registration.sessionId !== sessionId) {
        continue;
      }
      registration.socket.emit('auth:session-revoked', {
        code: 'SIGNED_IN_ON_ANOTHER_DEVICE',
        message: 'This account was signed in on another device',
      });
      registration.socket.disconnect(true);
      sockets.delete(key);
    }
    if (sockets.size === 0) {
      this.socketsByUser.delete(userId);
    }
  }

  private socketKey(socket: Socket) {
    return `${socket.nsp.name}:${socket.id}`;
  }
}
