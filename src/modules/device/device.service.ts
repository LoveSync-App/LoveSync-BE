/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Device } from "./schema/device.schema";
import { Model, Types } from "mongoose";
import { User } from "../users/schemas/user.schema";

@Injectable()
export class DeviceService {

    constructor(
        @InjectModel(Device.name)
        private deviceModel : Model<Device>,
        @InjectModel(User.name)
        private userModel : Model<User>
    )
    {}

    async registerDevice(userId: string, token: string): Promise<Device> {
        const objectUserId = new Types.ObjectId(userId);
        const user = await this.userModel.findById(objectUserId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const existingDevice = await this.deviceModel.findOne({ user: objectUserId });
        if (existingDevice) {
            existingDevice.token = token;
            return existingDevice.save();
        }
        const newDevice = new this.deviceModel({ user: objectUserId, token });
        return newDevice.save();
    }

}