import { Controller, Get, HttpCode, Injectable, Req, UseGuards } from "@nestjs/common";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller('users')
export class UserController {
    constructor(
        private readonly userService: UserService
    ){}

    @UseGuards(JwtAuthGuard)
    @Get("me")
    async getMe(@Req() req) {
        const id = req.user.id;
        const response = await this.userService.getById(id);
        return {
            success: true,
            statusCode: 200,
            data: response
        }
    }
}