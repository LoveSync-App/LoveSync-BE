import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LocationCoordinatesDto } from './location-coordinates.dto';

export class StartLiveLocationDto extends LocationCoordinatesDto {
  @IsOptional()
  @IsBoolean()
  untilStopped = false;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes = 60;
}
