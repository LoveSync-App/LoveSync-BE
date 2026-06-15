import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ObjectId, Types } from "mongoose";
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
            user.code = Math.random().toString(36).substring(2, 10);
            while(await this.userModel.findOne({ code: user.code })) {
                user.code = Math.random().toString(36).substring(2, 10);
            }
            await user.save();
        }
        return { code: user.code || null };
    }

    public async linkCouple(userId: string, code: string): Promise<Couple | null> {
        const userObjectId = new Types.ObjectId(userId);

        const user = await this.userModel.findById(userObjectId);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        if (await this.existCoupleAcitve(userObjectId)) {
            throw new ConflictException('User is already in an active couple');
        }

        const partner = await this.userModel.findOne({ code: code });
        if (!partner) {
            throw new NotFoundException('Partner with the provided code not found');
        }
        if (await this.existCoupleAcitve(partner._id)) {
            throw new ConflictException('Partner is already in an active couple');
        }

        const newCouple = new this.coupleModel({
            user_1: user._id,
            user_2: partner._id,
            start_date: new Date(),
            status: CoupleStatus.ACTIVE
        });
        await newCouple.save();
        return newCouple;
    }

    private async existCoupleAcitve(userId: Types.ObjectId): Promise<boolean> {
        const coupleUser1 = await this.coupleModel.findOne({ $or: [
            { user_1: userId },
            { user_2: userId }
        ], status: CoupleStatus.ACTIVE });
        if (coupleUser1) {
            return true;
        }
        return false;
    }

    public async getLoveDays(userId: string): Promise<{ loveDays: number } | null> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const activeCouple = await this.coupleModel.findOne({
            status: CoupleStatus.ACTIVE,
            $or: [
                { user_1: user._id },
                { user_2: user._id },
            ],
        });

        if (!activeCouple) {
            throw new NotFoundException('User is not in an active couple');
        }
        const partnerId = activeCouple.user_1.equals(user._id)
            ? activeCouple.user_2
            : activeCouple.user_1;
        
        const historyCouples = await this.coupleModel.find({
            status: CoupleStatus.BROKEN_UP,
            $or: [
                { user_1: user._id, user_2: partnerId },
                { user_1: partnerId, user_2: user._id },
            ],
        });

        console.log("historyCouples: ", historyCouples);

        let loveDays = 0;
        for (const couple of historyCouples) {
            const startDate = couple.start_date;
            const endDate = couple.updatedAt;
            loveDays += Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        const startDate = activeCouple.start_date;
        const currentDate = new Date();
        loveDays = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + loveDays;
        return { loveDays };
    }

    public async unlinkCouple(userId: string): Promise<Couple | null> {
        const activeCouple = await this.coupleModel.findOne({ user_1: userId, status: CoupleStatus.ACTIVE });
        if (!activeCouple) {
            throw new NotFoundException('User is not in an active couple');
        }
        activeCouple.status = CoupleStatus.BROKEN_UP;
        await activeCouple.save();
        return activeCouple;
    }

    public async checkCoupleCode(code: string): Promise<Object | null> {
        const partner = await this.userModel.findOne({ code: code });
        if (!partner) {
            throw new NotFoundException('Partner with the provided code not found');
        }

        return {
            partnerId: partner._id,
            partnerName: partner.name,
            partnerAvatar: partner.avatar,
            partnerEmail: partner.email,
            partnerPhone: partner.phone
        }
    }

    public async getMyCouple(userId: string): Promise<Object | null> {
        const userObjectId = new Types.ObjectId(userId);

        const activeCouple = await this.coupleModel.findOne({
            status: CoupleStatus.ACTIVE,
            $or: [
                { user_1: userObjectId },
                { user_2: userObjectId },
            ],
        }).populate('user_1', 'name avatar email phone').populate('user_2', 'name avatar email phone');

        if (!activeCouple) {
            throw new NotFoundException('User is not in an active couple');
        }

        const partner = activeCouple.user_1._id.equals(userObjectId) 
            ? 
                activeCouple.user_2 as any 
            : 
                activeCouple.user_1 as any;

        const user = activeCouple.user_1._id.equals(userObjectId)
            ? activeCouple.user_1 as any
            : activeCouple.user_2 as any;

        return {
            coupleId: activeCouple._id,
            userId: user._id,
            userName: user.name,
            userAvatar: user.avatar,
            userEmail: user.email,
            userPhone: user.phone,
            partnerId: partner._id,
            partnerName: partner?.name,
            partnerAvatar: partner.avatar,
            partnerEmail: partner.email,
            partnerPhone: partner.phone,
            startDate: activeCouple.start_date
        };
    }
}