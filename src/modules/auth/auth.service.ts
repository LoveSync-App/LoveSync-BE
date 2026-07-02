import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { compare, hash } from 'bcrypt';
import { DecodedIdToken } from 'firebase-admin/auth';
import { Model } from 'mongoose';
import { UserStatus } from '../users/enum/user-role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AuthSessionService } from './auth-session.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginRegisterDto } from './dto/login-register.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { AuthProvider } from './enum/auth-provider.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly authSessionService: AuthSessionService,
    private readonly firebaseIdentityService: FirebaseIdentityService,
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

  private async issueLoginResponse(
    user: UserDocument,
    loginProvider: AuthProvider,
  ) {
    const sessionId = await this.authSessionService.startSession(
      user._id.toString(),
    );
    const accessToken = await this.jwtService.signAsync({
      sub: user._id.toString(),
      email: user.email,
      sid: sessionId,
    });
    return {
      user: this.toUserResponse(user),
      loginProvider,
      accessToken,
    };
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
