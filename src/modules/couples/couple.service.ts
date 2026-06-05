import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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
            throw new NotFoundException('User not found');
        }
        if (!user.code) {
            user.code = randomUUID();
            await user.save();
        }
        return { code: user.code || null };
    }

    public async linkCouple(userId: string, code: string): Promise<Couple | null> {
        // kiểm tra 2 user hiện tại có đang trong một cặp đôi nào không
        if (await this.existCoupleAcitve(userId)) {
            throw new ConflictException('User is already in an active couple');
        }

        // tìm kiếm user có code
        const partner = await this.userModel.findOne({ code: code });
        if (!partner) {
            throw new NotFoundException('Partner with the provided code not found');
        }
        if (await this.existCoupleAcitve(partner._id.toString())) {
            throw new ConflictException('Partner is already in an active couple');
        }

        // Tạo cặp đôi mới
        const newCouple = new this.coupleModel({
            user_1: userId,
            user_2: partner._id,
            start_date: new Date(),
            status: CoupleStatus.ACTIVE
        });
        await newCouple.save();
        return newCouple;
    }

    private async existCoupleAcitve(userId: string): Promise<boolean> {
        const coupleUser1 = await this.coupleModel.findOne({ user_1: userId, status: CoupleStatus.ACTIVE });
        if (coupleUser1) {
            return true;
        }
        return false;
    }

    public async getLoveDays(userId: string): Promise<{ loveDays: number } | null> {
        const coupleUser1 = await this.coupleModel.findOne({ user_1: userId , status: CoupleStatus.ACTIVE});
        if (!coupleUser1) {
            throw new NotFoundException('User is not in an active couple');
        }
        const startDate = coupleUser1.start_date;
        const currentDate = new Date();
        const loveDays = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return { loveDays };
    }

}