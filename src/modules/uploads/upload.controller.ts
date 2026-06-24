import {
    BadRequestException,
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Post('image')
    @UseInterceptors(FileInterceptor('image'))
    async uploadImage(@UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('Image file is required');
        }

        const result = await this.uploadService.uploadImage(file);

        return {
            success: true,
            statusCode: 201,
            data: {
                url: result.secure_url,
                publicId: result.public_id,
            }
        };
    }
}