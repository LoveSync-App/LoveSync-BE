import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { GetTimelineQueryDto } from './get-timeline-query.dto';

describe('GetTimelineQueryDto', () => {
  it('uses the default page size', async () => {
    const dto = plainToInstance(GetTimelineQueryDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(20);
  });

  it('accepts an ObjectId cursor and transforms limit', async () => {
    const cursor = new Types.ObjectId().toString();
    const dto = plainToInstance(GetTimelineQueryDto, {
      cursor,
      limit: '30',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.cursor).toBe(cursor);
    expect(dto.limit).toBe(30);
  });

  it('rejects invalid cursors and excessive limits', async () => {
    const dto = plainToInstance(GetTimelineQueryDto, {
      cursor: 'invalid',
      limit: '101',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'cursor',
      'limit',
    ]);
  });
});
