import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
}
