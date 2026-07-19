import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresenceService } from './presence.service';

@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  public constructor(private readonly presenceService: PresenceService) {}

  @Get('partner')
  getPartnerPresence(@Request() req: { user: { id: string } }) {
    return this.presenceService.getPartnerPresence(req.user.id);
  }
}
