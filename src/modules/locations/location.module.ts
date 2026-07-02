import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CoupleModule } from '../couples/couple.module';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';
import { LocationRealtimeService } from './location-realtime.service';
import { PresenceModule } from '../presence/presence.module';
import { LocationSchema, Location } from './schemas/location.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Location.name,
        schema: LocationSchema,
      },
    ]),
    AuthModule,
    CoupleModule,
    PresenceModule,
  ],
  controllers: [LocationController],
  providers: [LocationService, LocationGateway, LocationRealtimeService],
  exports: [MongooseModule, LocationService],
})
export class LocationModule {}
