import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMemoryDto } from './create-memory.dto';

describe('CreateMemoryDto', () => {
  it('accepts description, image URL and time', async () => {
    const dto = plainToInstance(CreateMemoryDto, {
      description: '  Chuyến đi Đà Lạt  ',
      file_url: '  https://example.com/memory.jpg  ',
      time: '2026-07-01T10:30:00.000Z',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(dto.description).toBe('Chuyến đi Đà Lạt');
    expect(dto.file_url).toBe('https://example.com/memory.jpg');
  });

  it('rejects the removed title field', async () => {
    const dto = plainToInstance(CreateMemoryDto, {
      title: 'Legacy title',
      description: 'Kỷ niệm',
      file_url: 'https://example.com/memory.jpg',
      time: '2026-07-01T10:30:00.000Z',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((error) => error.property === 'title')).toBe(true);
  });

  it('requires all three fields and a valid ISO time', async () => {
    const dto = plainToInstance(CreateMemoryDto, {
      description: '',
      file_url: '',
      time: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'description',
      'file_url',
      'time',
    ]);
  });
});
