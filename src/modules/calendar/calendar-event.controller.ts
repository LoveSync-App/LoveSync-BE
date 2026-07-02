import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CalendarEventService } from './calendar-event.service';
import { CalendarRangeQueryDto } from './dto/calendar-range-query.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('calendar/events')
export class CalendarEventController {
  public constructor(
    private readonly calendarEventService: CalendarEventService,
  ) {}

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarEventService.create(req.user.id, dto);
  }

  @Get()
  list(
    @Request() req: { user: { id: string } },
    @Query() query: CalendarRangeQueryDto,
  ) {
    return this.calendarEventService.list(req.user.id, query);
  }

  @Get(':eventId')
  getById(
    @Request() req: { user: { id: string } },
    @Param('eventId') eventId: string,
  ) {
    return this.calendarEventService.getById(req.user.id, eventId);
  }

  @Patch(':eventId')
  update(
    @Request() req: { user: { id: string } },
    @Param('eventId') eventId: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarEventService.update(req.user.id, eventId, dto);
  }

  @Delete(':eventId')
  remove(
    @Request() req: { user: { id: string } },
    @Param('eventId') eventId: string,
  ) {
    return this.calendarEventService.remove(req.user.id, eventId);
  }
}
