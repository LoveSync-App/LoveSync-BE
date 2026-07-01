import { InjectModel } from '@nestjs/mongoose';
import { Memory, MemoryDocument } from './schemas/memory.schema';
import { Model, Types } from 'mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { CoupleStatus } from '../couples/enum/couple-status.enum';

@Injectable()
export class MemoryService {
  constructor(
    @InjectModel(Memory.name)
    private readonly memoryModel: Model<MemoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
  ) {}

  // Tạo một memory mới
  public async createMemory(userId: string, createMemoryDto: CreateMemoryDto) {
    const user = await this.getUserInfo(userId);

    const couple = await this.getCoupleInfoByUserId(userId);

    const newMemory = new this.memoryModel({
      couple: couple._id,
      uploader: user._id,
      description: createMemoryDto.description,
      file_url: createMemoryDto.file_url,
      time: new Date(createMemoryDto.time),
    });
    return await newMemory.save();
  }

  // Lấy các kỷ niệm của user đó theo couple hiện tại
  public async getMemoriesByUserId(userId: string) {
    const couple = await this.getCoupleInfoByUserId(userId);
    const memories = await this.memoryModel
      .find({ couple: couple._id })
      .sort({ time: -1 });
    return memories;
  }

  // Private: lấy thông tin user
  private async getUserInfo(userId: string): Promise<UserDocument> {
    const objectUserId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(objectUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Private: lấy thông tin couple
  private async getCoupleInfoByUserId(userId: string): Promise<CoupleDocument> {
    const objectUserId = new Types.ObjectId(userId);
    const couple = await this.coupleModel.findOne({
      $or: [
        {
          user_1: objectUserId,
        },
        {
          user_2: objectUserId,
        },
      ],
      status: CoupleStatus.ACTIVE,
    });
    if (!couple) {
      throw new NotFoundException('Couple not found');
    }
    return couple;
  }
}
