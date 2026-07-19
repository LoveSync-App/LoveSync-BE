import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CoupleModule } from '../couples/couple.module';
import { UserModule } from '../users/user.module';
import { E2eeController } from './e2ee.controller';
import { E2eeService } from './e2ee.service';
import {
  E2eeKeyBundle,
  E2eeKeyBundleSchema,
} from './schemas/e2ee-key-bundle.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: E2eeKeyBundle.name,
        schema: E2eeKeyBundleSchema,
      },
    ]),
    AuthModule,
    CoupleModule,
    UserModule,
  ],
  controllers: [E2eeController],
  providers: [E2eeService],
  exports: [E2eeService],
})
export class E2eeModule {}
