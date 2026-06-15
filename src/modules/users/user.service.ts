import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { Model } from "mongoose";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name) 
        private userModel: Model<UserDocument>
    ){}

    async getById(id: string): Promise<Object> {
        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException("User not found");
        }

        return {
            id: user._id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            status: user.status,
            avatar: user.avatar
        }
    }
}