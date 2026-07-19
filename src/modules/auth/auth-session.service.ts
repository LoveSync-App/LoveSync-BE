import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { Socket } from 'socket.io';
import { UserStatus } from '../users/enum/user-role.enum';
import { User } from '../users/schemas/user.schema';
import { Device, DeviceDocument } from '../device/schema/device.schema';

export type SessionJwtPayload = {
  sub?: string;
  email?: string;
  sid?: string;
  typ?: 'access' | 'refresh';
  jti?: string;
};

type RegisteredSocket = {
  sessionId: string;
  socket: Socket;
};

type SessionRevokedPayload = {
  code: string;
  message: string;
};

const DEFAULT_SESSION_REVOKED_PAYLOAD: SessionRevokedPayload = {
  code: 'SIGNED_IN_ON_ANOTHER_DEVICE',
  message: 'This account was signed in on another device',
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
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
  ) { }

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
          $unset: {
            refreshTokenHash: 1,
          },
        },
        { returnDocument: 'before' },
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
    if (
      !payload.sub ||
      !payload.sid ||
      payload.typ === 'refresh' ||
      !Types.ObjectId.isValid(payload.sub)
    ) {
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

  async storeRefreshToken(
    userId: string,
    sessionId: string,
    refreshTokenHash: string,
  ) {
    const result = await this.userModel.updateOne(
      { _id: userId, activeSessionId: sessionId },
      { $set: { refreshTokenHash } },
    );
    if (result.matchedCount === 0) {
      throw new UnauthorizedException(
        'Authentication session is no longer active',
      );
    }
  }

  async rotateRefreshToken(
    payload: SessionJwtPayload,
    currentRefreshTokenHash: string,
    nextRefreshTokenHash: string,
  ) {
    if (
      !payload.sub ||
      !payload.sid ||
      payload.typ !== 'refresh' ||
      !payload.jti ||
      !Types.ObjectId.isValid(payload.sub)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const result = await this.userModel.updateOne(
      {
        _id: payload.sub,
        activeSessionId: payload.sid,
        refreshTokenHash: currentRefreshTokenHash,
        status: UserStatus.ACTIVE,
      },
      {
        $set: {
          refreshTokenHash: nextRefreshTokenHash,
        },
      },
    );
    if (result.modifiedCount === 0) {
      throw new UnauthorizedException(
        'Refresh token is expired or already used',
      );
    }
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
      { _id: new Types.ObjectId(userId), activeSessionId: sessionId },
      { $unset: { activeSessionId: 1, refreshTokenHash: 1 } },
    );
    if (result.modifiedCount > 0) {
      this.disconnectSessionSockets(userId, sessionId);
    }
    // Xóa fcm token của user trong session này
    const device = await this.deviceModel.findOneAndDelete({
      user: new Types.ObjectId(userId),
    });

    if (!device) {
      await this.deviceModel.deleteOne({
        user: new Types.ObjectId(userId),
      });
    }
    return { loggedOut: true };
  }

  async revokeUserSessions(
    userId: string,
    code = DEFAULT_SESSION_REVOKED_PAYLOAD.code,
    message = DEFAULT_SESSION_REVOKED_PAYLOAD.message,
  ) {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $unset: { activeSessionId: 1, refreshTokenHash: 1 } },
        { returnDocument: 'before' },
      )
      .select('+activeSessionId');

    if (user?.activeSessionId) {
      this.disconnectSessionSockets(userId, user.activeSessionId, {
        code,
        message,
      });
    }

    return { revoked: true };
  }

  private disconnectSessionSockets(
    userId: string,
    sessionId: string,
    payload: SessionRevokedPayload = DEFAULT_SESSION_REVOKED_PAYLOAD,
  ) {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) {
      return;
    }
    for (const [key, registration] of sockets) {
      if (registration.sessionId !== sessionId) {
        continue;
      }
      registration.socket.emit('auth:session-revoked', payload);
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
