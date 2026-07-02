import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { CalendarEventType } from '../enum/calendar-event-type.enum';

export class CalendarRangeQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsEnum(CalendarEventType)
  type?: CalendarEventType;
}
