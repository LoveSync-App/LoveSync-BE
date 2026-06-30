import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CoupleModule } from '../couples/couple.module';
import { DeviceModule } from '../device/device.module';
import { NotificationModule } from '../notifications/notification.module';
import { UserModule } from '../users/user.module';
import { CallController, CallWebhookController } from './call.controller';
import { CallGateway } from './call.gateway';
import { CallService } from './call.service';
import { Call, CallSchema } from './schemas/call.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    AuthModule,
    CoupleModule,
    DeviceModule,
    NotificationModule,
    UserModule,
  ],
  controllers: [CallController, CallWebhookController],
  providers: [CallService, CallGateway],
  exports: [CallService],
})
export class CallModule {}
