import { Controller, Get } from "@nestjs/common";
import { NotificationService } from "./notification_service";
import { title } from "process";

@Controller('notifications')
export class NotificationController {

    constructor(
        private readonly notificationService:   NotificationService
    ) {}

    @Get()
    async getNotifications()  {
        const response = await this.notificationService.sendNotification(
            "eHRLCJjeTqm48E4hPwq_SS:APA91bFvlLxLldnNLgcpWnbu2MlZdR04XSg7woftf0Q92SZPm3MckvTqO0OyneJeXE0qvO9JgMS10smkZQe4E2iRAxrdUo34Yy2jPIa4XoQC6Ps5-wvY39U",
            "LoveSync",
            "Partner vừa gửi tin nhắn cho bạn"
        );

        return response;
    }
}