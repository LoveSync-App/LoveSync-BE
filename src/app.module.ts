import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './modules/users/user.module';
import { MongoConfigModule } from './config/mongo.config';
import { AlbumModule } from './modules/albums/album.module';
import { AppointmentModule } from './modules/appointments/appointment.module';
import { ChatModule } from './modules/chat/chat.module';
import { LocationModule } from './modules/locations/location.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { SpecialDateModule } from './modules/special-dates/special-date.module';
import { DotenvConfigModule } from './config/dotenv.config';
import { CoupleModule } from './modules/couples/couple.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    DotenvConfigModule,
    MongoConfigModule,
    AlbumModule,
    AppointmentModule,
    ChatModule,
    ConfigModule,
    LocationModule,
    NotificationModule,
    SpecialDateModule,
    UserModule,
    CoupleModule,
    AuthModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
  