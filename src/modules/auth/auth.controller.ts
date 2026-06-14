import { Body, Controller, Post, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginRequestDto } from "./dto/login-request.dto";

@Controller('auth')
export class AuthController {

    constructor(
        private readonly authService: AuthService
    ){}

    @Post('login')
    async login(@Body() loginRequestDto : LoginRequestDto) {
        const response = await this.authService.login(loginRequestDto);
        return {
            success: true,
            statusCode: 200,
            data: response
        }
    }


}