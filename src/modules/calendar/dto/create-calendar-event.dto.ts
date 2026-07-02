import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CalendarEventType } from '../enum/calendar-event-type.enum';
import { CalendarRecurrence } from '../enum/calendar-recurrence.enum';

export class CreateCalendarEventDto {
  @IsEnum(CalendarEventType)
  type: CalendarEventType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  startsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsEnum(CalendarRecurrence)
  recurrence: CalendarRecurrence = CalendarRecurrence.NONE;

  @IsOptional()
  @IsBoolean()
  reminderEnabled = true;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(525600)
  reminderMinutesBefore = 1440;
}
