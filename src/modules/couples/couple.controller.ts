import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
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
            message: null,
            data: {
                userId: userId,
                code: response.code
            }
        }
    }   

    // Liên kết cặp đôi
    


    // Hủy liên kết cặp đôi

    // Hiển thị số ngày yêu nhau

}