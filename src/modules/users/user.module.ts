import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UploadModule } from '../uploads/upload.module';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
  ],
  exports: [MongooseModule, UserService],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
