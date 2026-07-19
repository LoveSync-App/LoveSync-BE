import { MemorySchema } from './memory.schema';

describe('MemorySchema', () => {
  it('stores only the requested memory content fields', () => {
    expect(MemorySchema.path('description')).toBeDefined();
    expect(MemorySchema.path('file_url')).toBeDefined();
    expect(MemorySchema.path('time')).toBeDefined();
    expect(MemorySchema.path('title')).toBeUndefined();
    expect(MemorySchema.path('emotion')).toBeUndefined();
    expect(MemorySchema.path('location')).toBeUndefined();
    expect(MemorySchema.path('file_type')).toBeUndefined();
  });

  it('requires description, image URL and time', () => {
    expect(MemorySchema.path('description').isRequired).toBe(true);
    expect(MemorySchema.path('file_url').isRequired).toBe(true);
    expect(MemorySchema.path('time').isRequired).toBe(true);
  });
});
