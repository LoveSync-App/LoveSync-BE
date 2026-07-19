import { Module } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserModule } from '../users/user.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthSessionService } from './auth-session.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { DeviceModule } from '../device/device.module';
import { MailModule } from '../mail/mail.module';
import { FirebaseConfigModule } from '../../config/firebase.config';

@Module({
  imports: [
    UserModule,
    PassportModule,
    DeviceModule,
    MailModule,
    FirebaseConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET_KEY'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  exports: [JwtAuthGuard, JwtModule, AuthSessionService],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    AuthService,
    AuthSessionService,
    FirebaseIdentityService,
  ],
})
export class AuthModule {}
