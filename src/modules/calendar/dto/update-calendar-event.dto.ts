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

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsEnum(CalendarEventType)
  type?: CalendarEventType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsEnum(CalendarRecurrence)
  recurrence?: CalendarRecurrence;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(525600)
  reminderMinutesBefore?: number;
}
