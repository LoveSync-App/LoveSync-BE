import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginRequestDto } from "./dto/login-request.dto";
import { LoginRegisterDto } from "./dto/login-register.dto";

@Controller('auth')
export class AuthController {

    constructor(
        private readonly authService: AuthService
    ){}

    @Post('login')
    @HttpCode(200)
    async login(@Body() loginRequestDto : LoginRequestDto) {
        const response = await this.authService.login(loginRequestDto);
        return {
            success: true,
            statusCode: 200,
            data: response
        }
    }

    @Post('register')
    @HttpCode(201)
    async register(@Body() loginRegisterDto: LoginRegisterDto) {
        const response = await this.authService.register(loginRegisterDto);
        return {
            success: true,
            statusCode: 201,
            data: response
        }
    }

}