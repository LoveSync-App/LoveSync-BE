import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartLiveLocationDto } from './dto/start-live-location.dto';
import { UpdateLiveLocationDto } from './dto/update-live-location.dto';
import { LocationService } from './location.service';

@UseGuards(JwtAuthGuard)
@Controller('locations/live')
export class LocationController {
  public constructor(private readonly locationService: LocationService) {}

  @Post('start')
  startSharing(
    @Request() req: { user: { id: string } },
    @Body() dto: StartLiveLocationDto,
  ) {
    return this.locationService.startSharing(req.user.id, dto);
  }

  @Put()
  updateSharing(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateLiveLocationDto,
  ) {
    return this.locationService.updateSharing(req.user.id, dto);
  }

  @Post('stop')
  stopSharing(@Request() req: { user: { id: string } }) {
    return this.locationService.stopSharing(req.user.id);
  }

  @Get('me')
  getMySharing(@Request() req: { user: { id: string } }) {
    return this.locationService.getMySharing(req.user.id);
  }

  @Get('partner')
  getPartnerSharing(@Request() req: { user: { id: string } }) {
    return this.locationService.getPartnerSharing(req.user.id);
  }
}
