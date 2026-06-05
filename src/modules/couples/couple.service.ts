import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Couple, CoupleDocument } from "./schemas/couple.schema";
import { randomUUID } from "crypto";
import { CoupleStatus } from "./enum/couple-status.enum";

@Injectable()
export class CoupleService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Couple.name)   
        private readonly coupleModel: Model<CoupleDocument>
    ) {}

    public async getMyCoupleCode(userId: string): Promise<{ code: string | null }> {
        const user = await this.userModel.findById(userId).select('code');
        if (!user) {
            throw new Error('User not found');
        }
        if (!user.code) {
            user.code = randomUUID();
            await user.save();
        }
        return { code: user.code || null };
    }

   

}