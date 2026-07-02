import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { GetTimelineQueryDto } from './dto/get-timeline-query.dto';
import { SendLocationMessageDto } from './dto/send-location-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);
  public constructor(private readonly chatService: ChatService) {}

  @Post('send-message')
  async sendMessage(
    @Request() req: { user: { id: string } },
    @Body() body: SendMessageDto,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `Received send-message request from userId: ${userId} with message: ${body.message}`,
    );

    return this.chatService.sendMessage(userId, body);
  }

  @Post('location')
  sendLocation(
    @Request() req: { user: { id: string } },
    @Body() body: SendLocationMessageDto,
  ) {
    return this.chatService.sendLocationMessage(req.user.id, body);
  }

  @Get()
  async getMessages(
    @Request() req: { user: { id: string } },
    @Query() query: GetTimelineQueryDto,
  ) {
    const userId = req.user.id;
    return this.chatService.getMessagesForUser(userId, query);
  }
}
