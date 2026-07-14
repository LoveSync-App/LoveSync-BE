import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { compare, hash } from 'bcrypt';
import { createHash, randomInt, randomUUID } from 'crypto';
import { DecodedIdToken } from 'firebase-admin/auth';
import Redis from 'ioredis';
import { Model } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { UserStatus } from '../users/enum/user-role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuthSessionService, SessionJwtPayload } from './auth-session.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginRegisterDto } from './dto/login-register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthProvider } from './enum/auth-provider.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly authSessionService: AuthSessionService,
    private readonly firebaseIdentityService: FirebaseIdentityService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @Inject('REDIS_CONFIG')
    private readonly redis: Redis,
  ) {}

  async login(dto: LoginRequestDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ email })
      .select('+password +activeSessionId');
    if (!user || !user.password || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    user.authProviders ??= [];
    if (!user.authProviders.includes(AuthProvider.PASSWORD)) {
      user.authProviders.push(AuthProvider.PASSWORD);
      await user.save();
    }
    return this.issueLoginResponse(user, AuthProvider.PASSWORD);
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await this.firebaseIdentityService.verifyIdToken(
        dto.firebaseIdToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }
    if (decodedToken.firebase.sign_in_provider !== 'google.com') {
      throw new UnauthorizedException(
        'Firebase token is not from Google provider',
      );
    }
    if (!decodedToken.email || !decodedToken.email_verified) {
      throw new UnauthorizedException('Google account email must be verified');
    }

    const email = decodedToken.email.trim().toLowerCase();
    const tokenName = this.getOptionalString(decodedToken, 'name');
    const tokenAvatar = this.getOptionalString(decodedToken, 'picture');
    const userLinkedByFirebaseUid = await this.userModel
      .findOne({ firebaseUid: decodedToken.uid })
      .select('+password +firebaseUid +activeSessionId');
    if (
      userLinkedByFirebaseUid &&
      userLinkedByFirebaseUid.email.toLowerCase() !== email
    ) {
      throw new ConflictException(
        'Google account is already linked to another email',
      );
    }
    let user = await this.userModel
      .findOne({ email })
      .select('+password +firebaseUid +activeSessionId');
    if (!user) {
      try {
        user = await this.userModel.create({
          email,
          name: tokenName || dto.name.trim(),
          avatar: tokenAvatar || dto.avatar.trim(),
          firebaseUid: decodedToken.uid,
          authProviders: [AuthProvider.GOOGLE],
        });
      } catch (error) {
        if (!this.isMongoDuplicateKeyError(error)) {
          throw error;
        }
        user = await this.userModel
          .findOne({ email })
          .select('+password +firebaseUid +activeSessionId');
      }
    }
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is inactive');
    }

    user.authProviders ??= [];
    user.firebaseUid = decodedToken.uid;
    if (!user.authProviders.includes(AuthProvider.GOOGLE)) {
      user.authProviders.push(AuthProvider.GOOGLE);
    }
    if (!user.name) {
      user.name = tokenName || dto.name.trim();
    }
    if (!user.avatar) {
      user.avatar = tokenAvatar || dto.avatar.trim();
    }
    await user.save();
    return this.issueLoginResponse(user, AuthProvider.GOOGLE);
  }

  async register(dto: LoginRegisterDto) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException(
        'Password and password confirm do not match',
      );
    }
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.userModel
      .findOne({ email })
      .select('+password');
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
    const hashedPassword = await hash(dto.password, 10);

    const user = await this.userModel.create({
      name: dto.name.trim(),
      email,
      password: hashedPassword,
      authProviders: [AuthProvider.PASSWORD],
      avatar:
        'https://i.pinimg.com/550x/0a/2f/68/0a2f68448ab64c7fb67e75ef410de163.jpg',
    });
    return this.toUserResponse(user);
  }

  async setPassword(userId: string, dto: SetPasswordDto) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException(
        'Password and password confirm do not match',
      );
    }
    const user = await this.userModel.findById(userId).select('+password');
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is inactive');
    }
    if (user.password) {
      throw new ConflictException('Password login is already enabled');
    }

    user.password = await hash(dto.password, 10);
    user.authProviders ??= [];
    if (!user.authProviders.includes(AuthProvider.PASSWORD)) {
      user.authProviders.push(AuthProvider.PASSWORD);
    }
    await user.save();
    return this.toUserResponse(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.newPasswordConfirm) {
      throw new BadRequestException(
        'New password and confirmation do not match',
      );
    }

    const user = await this.userModel.findById(userId).select('+password');
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is inactive');
    }
    if (!user.password) {
      throw new BadRequestException('Password login is not enabled for this account');
    }

    // Verify current password
    const isPasswordValid = await compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await hash(dto.newPassword, 10);
    await user.save();
    return this.toUserResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: SessionJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<SessionJwtPayload>(
        dto.refreshToken,
        {
          secret: this.getRefreshTokenSecret(),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (
      payload.typ !== 'refresh' ||
      !payload.sub ||
      !payload.email ||
      !payload.sid ||
      !payload.jti
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.createTokenPair(
      payload.sub,
      payload.email,
      payload.sid,
    );
    await this.authSessionService.rotateRefreshToken(
      payload,
      this.hashRefreshToken(dto.refreshToken),
      this.hashRefreshToken(tokens.refreshToken),
    );
    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const expiresInSeconds = this.getPasswordResetOtpTtlSeconds();
    const cooldownSeconds = this.getPasswordResetCooldownSeconds();
    const cooldownKey = this.passwordResetCooldownKey(email);

    const isCoolingDown = await this.redis.get(cooldownKey);
    if (isCoolingDown) {
      return {
        sent: true,
        expiresInSeconds,
      };
    }

    const user = await this.userModel.findOne({
      email,
      status: UserStatus.ACTIVE,
    });
    if (user) {
      const otp = this.generateOtp();
      await this.redis.set(
        this.passwordResetOtpKey(email),
        JSON.stringify({
          hash: this.hashOtp(email, otp),
          attempts: 0,
        }),
        'EX',
        expiresInSeconds,
      );
      await this.redis.set(cooldownKey, '1', 'EX', cooldownSeconds);
      await this.mailService.sendHTMLMail(
        email,
        'Mã OTP khôi phục mật khẩu LoveSync',
        'otp',
        {
          name: user.name,
          otp,
          expiresIn: this.formatSecondsForEmail(expiresInSeconds),
        },
      );
    }

    return {
      sent: true,
      expiresInSeconds,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException(
        'Password and password confirm do not match',
      );
    }

    const email = this.normalizeEmail(dto.email);
    const otpKey = this.passwordResetOtpKey(email);
    const storedValue = await this.redis.get(otpKey);
    if (!storedValue) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const storedOtp = this.parseStoredPasswordResetOtp(storedValue);
    const maxAttempts = this.getPasswordResetMaxAttempts();
    if (storedOtp.hash !== this.hashOtp(email, dto.otp)) {
      const nextAttempts = storedOtp.attempts + 1;
      if (nextAttempts >= maxAttempts) {
        await this.redis.del(otpKey);
      } else {
        const ttl = await this.redis.ttl(otpKey);
        await this.redis.set(
          otpKey,
          JSON.stringify({
            ...storedOtp,
            attempts: nextAttempts,
          }),
          'EX',
          Math.max(ttl, 1),
        );
      }
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.userModel
      .findOne({
        email,
        status: UserStatus.ACTIVE,
      })
      .select('+password +activeSessionId');
    if (!user) {
      await this.redis.del(otpKey);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    user.password = await hash(dto.password, 10);
    user.authProviders ??= [];
    if (!user.authProviders.includes(AuthProvider.PASSWORD)) {
      user.authProviders.push(AuthProvider.PASSWORD);
    }
    await user.save();
    await this.redis.del(otpKey, this.passwordResetCooldownKey(email));
    await this.authSessionService.revokeUserSessions(
      user._id.toString(),
      'PASSWORD_RESET',
      'Password was reset for this account',
    );

    return {
      passwordReset: true,
    };
  }

  private async issueLoginResponse(
    user: UserDocument,
    loginProvider: AuthProvider,
  ) {
    const sessionId = await this.authSessionService.startSession(
      user._id.toString(),
    );
    const tokens = await this.createTokenPair(
      user._id.toString(),
      user.email,
      sessionId,
    );
    await this.authSessionService.storeRefreshToken(
      user._id.toString(),
      sessionId,
      this.hashRefreshToken(tokens.refreshToken),
    );
    return {
      user: this.toUserResponse(user),
      loginProvider,
      ...tokens,
    };
  }

  private async createTokenPair(
    userId: string,
    email: string,
    sessionId: string,
  ) {
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
      sid: sessionId,
      typ: 'access',
    });
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        sid: sessionId,
        typ: 'refresh',
        jti: randomUUID(),
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') ?? '30d',
      },
    );
    return {
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
    };
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private getRefreshTokenSecret() {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET_KEY');
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_REFRESH_SECRET_KEY is not configured',
      );
    }
    return secret;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateOtp() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashOtp(email: string, otp: string) {
    const pepper = this.configService.get<string>('PASSWORD_RESET_OTP_SECRET');
    if (!pepper) {
      throw new InternalServerErrorException(
        'PASSWORD_RESET_OTP_SECRET is not configured',
      );
    }
    return createHash('sha256')
      .update(`${email}:${otp}:${pepper}`)
      .digest('hex');
  }

  private passwordResetOtpKey(email: string) {
    return `auth:password-reset:otp:${email}`;
  }

  private passwordResetCooldownKey(email: string) {
    return `auth:password-reset:cooldown:${email}`;
  }

  private parseStoredPasswordResetOtp(value: string): {
    hash: string;
    attempts: number;
  } {
    try {
      const parsed = JSON.parse(value) as {
        hash?: unknown;
        attempts?: unknown;
      };
      if (typeof parsed.hash !== 'string') {
        throw new Error('Invalid OTP hash');
      }
      return {
        hash: parsed.hash,
        attempts:
          typeof parsed.attempts === 'number' && parsed.attempts >= 0
            ? parsed.attempts
            : 0,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
  }

  private getPasswordResetOtpTtlSeconds() {
    return this.getPositiveNumberConfig('PASSWORD_RESET_OTP_TTL_SECONDS', 300);
  }

  private getPasswordResetCooldownSeconds() {
    return this.getPositiveNumberConfig(
      'PASSWORD_RESET_OTP_COOLDOWN_SECONDS',
      60,
    );
  }

  private getPasswordResetMaxAttempts() {
    return this.getPositiveNumberConfig('PASSWORD_RESET_OTP_MAX_ATTEMPTS', 5);
  }

  private getPositiveNumberConfig(key: string, fallback: number) {
    const value = Number(this.configService.get<string | number>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private formatSecondsForEmail(seconds: number) {
    if (seconds % 60 === 0) {
      return `${seconds / 60} phút`;
    }
    return `${seconds} giây`;
  }

  private toUserResponse(user: UserDocument) {
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      authProviders: user.authProviders ?? [],
      e2eeSetupRequired: !user.hasE2eeKeys,
    };
  }

  private isMongoDuplicateKeyError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  private getOptionalString(source: object, key: string): string | undefined {
    const value = (source as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
