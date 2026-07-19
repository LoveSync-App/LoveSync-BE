import { IsEnum, IsOptional } from 'class-validator';
import { CallType } from '../enum/call-type.enum';

export class CreateCallDto {
  @IsOptional()
  @IsEnum(CallType)
  type: CallType = CallType.AUDIO;
}
