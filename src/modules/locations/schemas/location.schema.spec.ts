import { LocationSchema } from './location.schema';

describe('LocationSchema', () => {
  it('stores live-sharing state and the latest coordinate only', () => {
    expect(LocationSchema.path('user')).toBeDefined();
    expect(LocationSchema.path('couple')).toBeDefined();
    expect(LocationSchema.path('isSharing')).toBeDefined();
    expect(LocationSchema.path('latitude')).toBeDefined();
    expect(LocationSchema.path('longitude')).toBeDefined();
    expect(LocationSchema.path('untilStopped')).toBeDefined();
    expect(LocationSchema.path('sharingExpiresAt')).toBeDefined();
  });
});
