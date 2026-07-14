import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginRegisterDto } from './dto/login-register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthSessionService } from './auth-session.service';
import { SetPasswordDto } from './dto/set-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginRequestDto: LoginRequestDto) {
    const response = await this.authService.login(loginRequestDto);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  @Post('google')
  @HttpCode(200)
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    const response = await this.authService.loginWithGoogle(dto);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    const response = await this.authService.refresh(dto);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  @Post('password/forgot')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const response = await this.authService.forgotPassword(dto);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  @Post('password/reset')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const response = await this.authService.resetPassword(dto);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() loginRegisterDto: LoginRegisterDto) {
    const response = await this.authService.register(loginRegisterDto);
    return {
      success: true,
      statusCode: 201,
      data: response,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('password')
  @HttpCode(200)
  async setPassword(
    @Request() req: { user: { id: string } },
    @Body() dto: SetPasswordDto,
  ) {
    const response = await this.authService.setPassword(req.user.id, dto);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  @HttpCode(200)
  async changePassword(
    @Request() req: { user: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    const response = await this.authService.changePassword(req.user.id, dto);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Request()
    req: {
      user: { id: string; sessionId: string };
    },
  ) {
    const response = await this.authSessionService.logout(
      req.user.id,
      req.user.sessionId,
    );
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }
}
