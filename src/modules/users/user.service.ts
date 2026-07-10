import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserStatus } from './enum/user-role.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) { }

  async getById(id: string): Promise<Object> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  async updateMe(id: string, updateMeDto: UpdateMeDto): Promise<Object> {
    const updateData: Partial<User> = {};

    if (updateMeDto.name !== undefined) {
      updateData.name = updateMeDto.name.trim();
    }

    if (updateMeDto.phone !== undefined) {
      const phone = updateMeDto.phone.trim();
      updateData.phone = phone || undefined;
    }

    if (updateMeDto.avatar !== undefined) {
      updateData.avatar = updateMeDto.avatar.trim();
    }

    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  async deleteMe(id: string): Promise<Object> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: { status: UserStatus.INACTIVE } },
      { returnDocument: 'after' },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  private toUserResponse(user: UserDocument): Object {
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      status: user.status,
      avatar: user.avatar,
    };
  }
}
