import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetupE2eeKeysDto } from './dto/setup-e2ee-keys.dto';
import { E2eeService } from './e2ee.service';

@UseGuards(JwtAuthGuard)
@Controller('e2ee')
export class E2eeController {
  constructor(private readonly e2eeService: E2eeService) {}

  @Post('keys')
  @HttpCode(201)
  setup(
    @Request() req: { user: { id: string } },
    @Body() dto: SetupE2eeKeysDto,
  ) {
    return this.e2eeService.setup(req.user.id, dto);
  }

  @Get('keys/me')
  getMyKeys(@Request() req: { user: { id: string } }) {
    return this.e2eeService.getMyKeys(req.user.id);
  }

  @Get('keys/partner')
  getPartnerPublicKey(@Request() req: { user: { id: string } }) {
    return this.e2eeService.getPartnerPublicKey(req.user.id);
  }
}
