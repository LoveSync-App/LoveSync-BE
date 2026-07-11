import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CoupleService } from './couple.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvitationStatus } from './enum/invitation-status.enum';
import { UpdateCoupleStartDateDto } from './dto/update-couple-start-date.dto';

@UseGuards(JwtAuthGuard)
@Controller('couples')
export class CoupleController {
  constructor(private readonly coupleService: CoupleService) {}

  // Lấy mã COUPLE của người dùng
  @Get('code/me')
  @HttpCode(200)
  async getMyCoupleCode(@Req() req) {
    const userId = req.user.id;
    const response = await this.coupleService.getMyCoupleCode(userId);
    return {
      success: true,
      statusCode: 200,
      data: {
        userId: userId,
        code: response.code,
      },
    };
  }

  @Get('code/:code')
  @HttpCode(200)
  async checkCoupleCode(@Param('code') code: string) {
    const response = await this.coupleService.checkCoupleCode(code);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  // Liên kết cặp đôi
  @Post('code/:code')
  @HttpCode(201)
  async linkCouple(@Param('code') code: string, @Req() req) {
    const userId = req.user.id;
    const couple = await this.coupleService.linkCouple(userId, code);
    return {
      success: true,
      statusCode: 201,
      data: couple,
    };
  }

  // Hủy liên kết cặp đôi
  @Patch('me/unlink')
  @HttpCode(200)
  async unlinkCouple(@Req() req) {
    const userId = req.user.id;
    const couple = await this.coupleService.unlinkCouple(userId);
    return {
      success: true,
      statusCode: 200,
      data: couple,
    };
  }

  // Hiển thị số ngày yêu nhau
  @Get('me/love-days')
  @HttpCode(200)
  async getLoveDays(@Req() req) {
    const userId = req.user.id;
    const couple = await this.coupleService.getLoveDays(userId);
    return {
      success: true,
      statusCode: 200,
      data: couple,
    };
  }

  @Patch('me/start-date')
  @HttpCode(200)
  async updateStartDate(@Req() req, @Body() dto: UpdateCoupleStartDateDto) {
    const result = await this.coupleService.updateStartDate(
      req.user.id,
      dto.startDate,
    );
    return {
      success: true,
      statusCode: 200,
      data: result,
    };
  }

  @Get('me')
  @HttpCode(200)
  async getMyCouple(@Req() req) {
    const userId = req.user.id;
    const couple = await this.coupleService.getMyCouple(userId);
    return {
      success: true,
      statusCode: 200,
      data: couple,
    };
  }

  @Get('invitations/:status')
  @HttpCode(200)
  async getInvitationByStatus(
    @Req() req,
    @Param('status') status: InvitationStatus,
  ) {
    const userId = req.user.id;
    const invitations = await this.coupleService.getInvitationByIdAndStatus(
      userId,
      status,
    );
    console.log(
      'Invitations for userId:',
      userId,
      'with status:',
      status,
      'are:',
      invitations,
    );
    return {
      success: true,
      statusCode: 200,
      data: invitations,
    };
  }

  @Patch('invitations/:invitationId/accept')
  @HttpCode(200)
  async acceptInvitation(
    @Req() req,
    @Param('invitationId') invitationId: string,
  ) {
    const userId = req.user.id;
    await this.coupleService.acceptInvitation(invitationId, userId);
    return {
      success: true,
      statusCode: 200,
      data: null,
    };
  }

  @Patch('invitations/:invitationId/reject')
  @HttpCode(200)
  async rejectInvitation(
    @Req() req,
    @Param('invitationId') invitationId: string,
  ) {
    const userId = req.user.id;
    await this.coupleService.rejectInvitation(invitationId, userId);
    return {
      success: true,
      statusCode: 200,
      data: null,
    };
  }
}
