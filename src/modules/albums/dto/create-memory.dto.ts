import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateMemoryDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  description: string;

  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsDateString()
  time: string;
}
