import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CallService } from './call.service';
import { CallHistoryQueryDto } from './dto/call-history-query.dto';
import { CreateCallDto } from './dto/create-call.dto';
import { CallType } from './enum/call-type.enum';

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallController {
  public constructor(private readonly callService: CallService) {}

  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateCallDto) {
    return this.callService.create(req.user.id, dto);
  }

  @Post('video')
  createVideoCall(@Request() req: { user: { id: string } }) {
    return this.callService.create(req.user.id, { type: CallType.VIDEO });
  }

  @Get('active')
  getActive(@Request() req: { user: { id: string } }) {
    return this.callService.getActive(req.user.id);
  }

  @Get('history')
  getHistory(
    @Request() req: { user: { id: string } },
    @Query() query: CallHistoryQueryDto,
  ) {
    return this.callService.getHistory(req.user.id, query);
  }

  @Get(':callId')
  getById(
    @Request() req: { user: { id: string } },
    @Param('callId') callId: string,
  ) {
    return this.callService.getById(req.user.id, callId);
  }

  @Get(':callId/participants')
  getParticipants(
    @Request() req: { user: { id: string } },
    @Param('callId') callId: string,
  ) {
    return this.callService.getParticipants(req.user.id, callId);
  }

  @Post(':callId/accept')
  accept(
    @Request() req: { user: { id: string } },
    @Param('callId') callId: string,
  ) {
    return this.callService.accept(req.user.id, callId);
  }

  @Post(':callId/reject')
  reject(
    @Request() req: { user: { id: string } },
    @Param('callId') callId: string,
  ) {
    return this.callService.reject(req.user.id, callId);
  }

  @Post(':callId/cancel')
  cancel(
    @Request() req: { user: { id: string } },
    @Param('callId') callId: string,
  ) {
    return this.callService.cancel(req.user.id, callId);
  }

  @Post(':callId/end')
  end(
    @Request() req: { user: { id: string } },
    @Param('callId') callId: string,
  ) {
    return this.callService.end(req.user.id, callId);
  }

  @Post(':callId/token')
  getToken(
    @Request() req: { user: { id: string } },
    @Param('callId') callId: string,
  ) {
    return this.callService.getToken(req.user.id, callId);
  }
}

@Controller('calls/webhooks')
export class CallWebhookController {
  public constructor(private readonly callService: CallService) {}

  @Post('livekit')
  handleLiveKitWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('authorization') authorization?: string,
  ) {
    return this.callService.handleWebhook(
      req.rawBody?.toString('utf8'),
      authorization,
    );
  }
}
