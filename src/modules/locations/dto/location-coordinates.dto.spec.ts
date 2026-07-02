import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StartLiveLocationDto } from './start-live-location.dto';
import { UpdateLiveLocationDto } from './update-live-location.dto';

describe('location DTOs', () => {
  it('accepts valid coordinates and defaults sharing to 60 minutes', async () => {
    const dto = plainToInstance(StartLiveLocationDto, {
      latitude: 10.7769,
      longitude: 106.7009,
      accuracy: 8,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.durationMinutes).toBe(60);
  });

  it('rejects coordinates outside the Earth bounds', async () => {
    const dto = plainToInstance(UpdateLiveLocationDto, {
      latitude: 91,
      longitude: -181,
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'latitude',
      'longitude',
    ]);
  });

  it('rejects sharing sessions longer than one day', async () => {
    const dto = plainToInstance(StartLiveLocationDto, {
      latitude: 10.7769,
      longitude: 106.7009,
      durationMinutes: 1441,
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'durationMinutes')).toBe(
      true,
    );
  });

  it('supports sharing until the user explicitly stops it', async () => {
    const dto = plainToInstance(StartLiveLocationDto, {
      latitude: 10.7769,
      longitude: 106.7009,
      untilStopped: true,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.untilStopped).toBe(true);
  });
});
