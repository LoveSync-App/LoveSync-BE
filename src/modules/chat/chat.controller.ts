import { Body, Controller, Get, Logger, Post, Request, UseGuards } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SendMessageDto } from "./dto/send-message.dto";


@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
    private readonly logger = new Logger(ChatController.name);
    public constructor(
        private readonly chatService: ChatService
    ) { }

    @Post('send-message')
    async sendMessage(
        @Request() req,
        @Body() body: SendMessageDto
    ) {
        const userId = req.user.id;
        this.logger.log(`Received send-message request from userId: ${userId} with message: ${body.message}`);

        return this.chatService.sendMessage(userId, body);
    }

    @Get()
    async getMessages(@Request() req) {
        const userId = req.user.id;
        return this.chatService.getMessagesForUser(userId);
    }


}
