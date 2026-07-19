import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Patch,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { UploadService } from '../uploads/upload.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly uploadService: UploadService,
    ) { }

    @Get('me')
    @HttpCode(200)
    async getMe(@Req() req) {
        const id = req.user.id;
        const response = await this.userService.getById(id);
        return {
            success: true,
            statusCode: 200,
            data: response,
        };
    }

    @Patch('me')
    @HttpCode(200)
    @UseInterceptors(FileInterceptor('avatar'))
    async updateMe(
        @Req() req,
        @Body() updateMeDto: UpdateMeDto,
        @UploadedFile() avatar?: any,
    ) {
        const id = req.user.id;

        if (avatar) {
            const uploadResult = await this.uploadService.uploadImage(avatar);
            updateMeDto.avatar = uploadResult.secure_url;
        }

        const response = await this.userService.updateMe(id, updateMeDto);
        return {
            success: true,
            statusCode: 200,
            data: response,
        };
    }

    @Delete('me')
    @HttpCode(200)
    async deleteMe(@Req() req) {
        const id = req.user.id;
        const response = await this.userService.deleteMe(id);
        return {
            success: true,
            statusCode: 200,
            data: response,
        };
    }
}
