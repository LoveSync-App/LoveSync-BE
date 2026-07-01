import { MessageType } from '../enum/message-type.enum';
import { MessageSchema } from './message.schema';

describe('Message timeline schema', () => {
  it('supports extensible timeline payloads', () => {
    expect(MessageSchema.path('entityId')).toBeDefined();
    expect(MessageSchema.path('payload')).toBeDefined();
    expect(Object.values(MessageType)).toEqual(
      expect.arrayContaining([
        MessageType.TEXT,
        MessageType.IMAGE,
        MessageType.CALL,
        MessageType.LOCATION,
      ]),
    );
  });
});
