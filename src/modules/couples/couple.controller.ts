import { Controller, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { CoupleService } from "./couple.service";

@Controller("couples")
export class CoupleController {

    constructor(
        private readonly coupleService: CoupleService
    ) {}

    // Lấy mã COUPLE của người dùng
    @Get("code/me")
    @HttpCode(200)
    async getMyCoupleCode() {
        const userId = "6a2315f160351a3aa19a43f5";
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
    async linkCouple(@Param("code") code: string) {
        const userId = "6a2315f160351a3aa19a43f5";
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
    async unlinkCouple() {
        const userId = "6a2315f160351a3aa19a43f5";
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
    async getLoveDays() {
        const userId = "6a2315f160351a3aa19a43f5";
        const couple = await this.coupleService.getLoveDays(userId);
        return {
            success: true,
            statusCode: 200,
            data: couple
        }
    }
    
}