import { IsOptional, IsString, MaxLength } from 'class-validator';
import { LocationCoordinatesDto } from '../../locations/dto/location-coordinates.dto';

export class SendLocationMessageDto extends LocationCoordinatesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
