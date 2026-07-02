import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './modules/users/user.module';
import { MongoConfigModule } from './config/mongo.config';
import { AlbumModule } from './modules/albums/album.module';
import { ChatModule } from './modules/chat/chat.module';
import { LocationModule } from './modules/locations/location.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { DotenvConfigModule } from './config/dotenv.config';
import { CoupleModule } from './modules/couples/couple.module';
import { AuthModule } from './modules/auth/auth.module';
import { DeviceModule } from './modules/device/device.module';
import { UploadModule } from './modules/uploads/upload.module';
import { CallModule } from './modules/calls/call.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CalendarModule } from './modules/calendar/calendar.module';

@Module({
  imports: [
    DotenvConfigModule,
    MongoConfigModule,
    AlbumModule,
    ScheduleModule.forRoot(),
    CalendarModule,
    ChatModule,
    ConfigModule,
    LocationModule,
    NotificationModule,
    UserModule,
    CoupleModule,
    AuthModule,
    DeviceModule,
    UploadModule,
    CallModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
