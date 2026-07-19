import type { Model } from 'mongoose';
import type { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new PresenceService(
      {} as Model<CoupleDocument, object, object, object, Couple>,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays online while at least one device is connected', () => {
    service.registerConnection('user-1', 'chat:socket-1');
    service.registerConnection('user-1', 'locations:socket-2');
    service.unregisterConnection('user-1', 'chat:socket-1');

    expect(service.getPresence('user-1').isOnline).toBe(true);
  });

  it('goes offline only after the grace period', () => {
    service.registerConnection('user-1', 'chat:socket-1');
    service.unregisterConnection('user-1', 'chat:socket-1');

    jest.advanceTimersByTime(19_999);
    expect(service.getPresence('user-1').isOnline).toBe(true);

    jest.advanceTimersByTime(1);
    const presence = service.getPresence('user-1');
    expect(presence.isOnline).toBe(false);
    expect(presence.connectedAt).toBeNull();
    expect(presence.lastSeenAt).toBeInstanceOf(Date);
  });

  it('cancels the offline transition when a device reconnects', () => {
    service.registerConnection('user-1', 'chat:socket-1');
    service.unregisterConnection('user-1', 'chat:socket-1');
    jest.advanceTimersByTime(10_000);

    service.registerConnection('user-1', 'chat:socket-2');
    jest.advanceTimersByTime(20_000);

    expect(service.getPresence('user-1').isOnline).toBe(true);
  });
});
