import { UnauthorizedException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Socket } from 'socket.io';
import { DeviceDocument } from '../device/schema/device.schema';
import { User } from '../users/schemas/user.schema';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  const userId = new Types.ObjectId().toString();
  let selectPreviousUser: jest.Mock;
  let selectActiveUser: jest.Mock;
  let userModel: {
    findByIdAndUpdate: jest.Mock;
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };
  let deviceModel: {
    findOneAndDelete: jest.Mock;
    deleteOne: jest.Mock;
  };
  let service: AuthSessionService;

  beforeEach(() => {
    selectPreviousUser = jest.fn();
    selectActiveUser = jest.fn();
    userModel = {
      findByIdAndUpdate: jest.fn(() => ({ select: selectPreviousUser })),
      findOne: jest.fn(() => ({ select: selectActiveUser })),
      updateOne: jest.fn(),
    };
    deviceModel = {
      findOneAndDelete: jest.fn(),
      deleteOne: jest.fn(),
    };
    service = new AuthSessionService(
      userModel as unknown as Model<User>,
      deviceModel as unknown as Model<DeviceDocument>,
    );
  });

  it('disconnects sockets belonging to the previous session', async () => {
    selectPreviousUser.mockResolvedValue({
      _id: new Types.ObjectId(userId),
      activeSessionId: 'old-session',
    });
    const emit = jest.fn();
    const disconnect = jest.fn();
    const socket = {
      id: 'socket-1',
      nsp: { name: '/chat' },
      emit,
      disconnect,
    } as unknown as Socket;
    service.registerSocket(userId, 'old-session', socket);

    const newSessionId = await service.startSession(userId);

    expect(newSessionId).not.toBe('old-session');
    expect(emit).toHaveBeenCalledWith('auth:session-revoked', {
      code: 'SIGNED_IN_ON_ANOTHER_DEVICE',
      message: 'This account was signed in on another device',
    });
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('accepts only the active session stored on the user', async () => {
    selectActiveUser.mockResolvedValue({
      _id: new Types.ObjectId(userId),
      email: 'user@example.com',
    });

    const result = await service.validatePayload({
      sub: userId,
      sid: 'active-session',
    });

    expect(userModel.findOne).toHaveBeenCalledWith({
      _id: userId,
      activeSessionId: 'active-session',
      status: 'ACTIVE',
    });
    expect(result.userId).toBe(userId);
    expect(result.sessionId).toBe('active-session');
  });

  it('rejects legacy tokens without a session id', async () => {
    await expect(
      service.validatePayload({ sub: userId }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('clears and disconnects the current session on logout', async () => {
    userModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
    deviceModel.findOneAndDelete.mockResolvedValue({});
    const disconnect = jest.fn();
    const socket = {
      id: 'socket-2',
      nsp: { name: '/calls' },
      emit: jest.fn(),
      disconnect,
    } as unknown as Socket;
    service.registerSocket(userId, 'current-session', socket);

    await expect(service.logout(userId, 'current-session')).resolves.toEqual({
      loggedOut: true,
    });
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: userId, activeSessionId: 'current-session' },
      { $unset: { activeSessionId: 1, refreshTokenHash: 1 } },
    );
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('stores refresh token only for the active session', async () => {
    userModel.updateOne.mockResolvedValue({ matchedCount: 1 });

    await expect(
      service.storeRefreshToken(userId, 'current-session', 'hashed-refresh'),
    ).resolves.toBeUndefined();

    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: userId, activeSessionId: 'current-session' },
      { $set: { refreshTokenHash: 'hashed-refresh' } },
    );
  });

  it('rejects refresh token storage when the session changed', async () => {
    userModel.updateOne.mockResolvedValue({ matchedCount: 0 });

    await expect(
      service.storeRefreshToken(userId, 'old-session', 'hashed-refresh'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh token when the current token hash matches', async () => {
    userModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await expect(
      service.rotateRefreshToken(
        {
          sub: userId,
          sid: 'current-session',
          typ: 'refresh',
          jti: 'refresh-id',
        },
        'current-refresh-hash',
        'next-refresh-hash',
      ),
    ).resolves.toBeUndefined();

    expect(userModel.updateOne).toHaveBeenCalledWith(
      {
        _id: userId,
        activeSessionId: 'current-session',
        refreshTokenHash: 'current-refresh-hash',
        status: 'ACTIVE',
      },
      {
        $set: {
          refreshTokenHash: 'next-refresh-hash',
        },
      },
    );
  });

  it('rejects an already-used refresh token', async () => {
    userModel.updateOne.mockResolvedValue({ modifiedCount: 0 });

    await expect(
      service.rotateRefreshToken(
        {
          sub: userId,
          sid: 'current-session',
          typ: 'refresh',
          jti: 'refresh-id',
        },
        'old-refresh-hash',
        'next-refresh-hash',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes all active session tokens and sockets', async () => {
    selectPreviousUser.mockResolvedValue({
      _id: new Types.ObjectId(userId),
      activeSessionId: 'current-session',
    });
    const emit = jest.fn();
    const disconnect = jest.fn();
    const socket = {
      id: 'socket-3',
      nsp: { name: '/chat' },
      emit,
      disconnect,
    } as unknown as Socket;
    service.registerSocket(userId, 'current-session', socket);

    await expect(
      service.revokeUserSessions(
        userId,
        'PASSWORD_RESET',
        'Password was reset for this account',
      ),
    ).resolves.toEqual({ revoked: true });

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      { $unset: { activeSessionId: 1, refreshTokenHash: 1 } },
      { returnDocument: 'before' },
    );
    expect(emit).toHaveBeenCalledWith('auth:session-revoked', {
      code: 'PASSWORD_RESET',
      message: 'Password was reset for this account',
    });
    expect(disconnect).toHaveBeenCalledWith(true);
  });
});
