import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MailService {
    constructor(private readonly mailerService: MailerService) { }

    async sendHTMLMail(to: string, subject: string, template: string, context: any): Promise<void> {
        await this.mailerService.sendMail({
            to,
            subject,
            template,
            context
        });
    }

    async sendTextMail(to: string, subject: string, text: string): Promise<void> {
        await this.mailerService.sendMail({
            to,
            subject,
            text
        });
    }
}