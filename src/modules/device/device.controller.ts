/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { DeviceService } from "./device.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller('device')
export class DeviceController {

    constructor(
        private readonly deviceService: DeviceService
    ) { }

    @Post()
    async registerDevice(@Req() req, @Body() body: { token: string }) {
        const userId = req.user.id;
        const response = await this.deviceService.registerDevice(userId, body.token);
        return {
            success: true,
            statusCode: 201,
            data: response
        }
    }

}