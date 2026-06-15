import { Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CoupleService } from "./couple.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("couples")
export class CoupleController {

    constructor(
        private readonly coupleService: CoupleService
    ) {}

    // Lấy mã COUPLE của người dùng
    @Get("code/me")
    @HttpCode(200)
    async getMyCoupleCode(@Req() req) {
        const userId = req.user.id;
        const response = await this.coupleService.getMyCoupleCode(userId);
        return {
            success: true,
            statusCode: 200,
            data: {
                userId: userId,
                code: response.code
            }
        }
    } 

    @Get("code/:code")
    @HttpCode(200)
    async checkCoupleCode(@Param("code") code: string) {
        const response = await this.coupleService.checkCoupleCode(code);
        return {
            success: true,
            statusCode: 200,
            data: response
        }

    }

    // Liên kết cặp đôi
    @Post("code/:code")
    @HttpCode(201)
    async linkCouple(@Param("code") code: string, @Req() req) {
        const userId = req.user.id;
        const couple = await this.coupleService.linkCouple(userId, code);
        return {
            success: true,
            statusCode: 201,
            data: couple
        }
    }


    // Hủy liên kết cặp đôi
    @Patch("me/unlink")
    @HttpCode(200)
    async unlinkCouple(@Req() req) {
        const userId = req.user.id;
        const couple = await this.coupleService.unlinkCouple(userId);
        return {
            success: true,
            statusCode: 200,
            data: couple
        }
    }

    // Hiển thị số ngày yêu nhau
    @Get("me/love-days")
    @HttpCode(200)
    async getLoveDays(@Req() req) {
        const userId = req.user.id;
        const couple = await this.coupleService.getLoveDays(userId);
        return {
            success: true,
            statusCode: 200,
            data: couple
        }
    }

    @Get("me")
    @HttpCode(200)
    async getMyCouple(@Req() req) {
        const userId = req.user.id;
        const couple = await this.coupleService.getMyCouple(userId);
        return {
            success: true,
            statusCode: 200,
            data: couple
        }
    }
    
}