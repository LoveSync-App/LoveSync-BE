/* eslint-disable prettier/prettier */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMemoryDto } from './dto/create-memory.dto';

@UseGuards(JwtAuthGuard)
@Controller('memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  // Tạo một memory mới
  @Post()
  public async createMemory(
    @Req() req: { user: { id: string } },
    @Body() createMemoryDto: CreateMemoryDto,
  ) {
    const userId = req.user.id;
    const response = await this.memoryService.createMemory(
      userId,
      createMemoryDto,
    );
    return {
      success: true,
      statusCode: 201,
      data: response,
    };
  }

  // Lấy các kỷ niệm của user đó theo couple hiện tại
  @Get()
  public async getMemoriesByUserId(@Req() req: { user: { id: string } }) {
    const userId = req.user.id;
    const response = await this.memoryService.getMemoriesByUserId(userId);
    return {
      success: true,
      statusCode: 200,
      data: response,
    };
  }

  // Xóa kỷ niệm theo id cho couple hiện tại
  @Delete(':id')
  @HttpCode(200)
  public async deleteMemory(@Req() req: { user: { id: string } }, @Param('id') memoryId: string) {
    const userId = req.user.id;
    await this.memoryService.deleteMemoryById(userId, memoryId);
    return {
      success: true,
      statusCode: 200,
      message: 'Memory deleted successfully',
    };
  }
}
