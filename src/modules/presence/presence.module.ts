import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoupleModule } from '../couples/couple.module';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

@Module({
  imports: [AuthModule, CoupleModule],
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
