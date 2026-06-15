import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ObjectId, Types } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Couple, CoupleDocument } from "./schemas/couple.schema";
import { randomUUID } from "crypto";
import { CoupleStatus } from "./enum/couple-status.enum";
import { CouplePeriod, CouplePeriodDocument } from "./schemas/couple_period.schema";

@Injectable()
export class CoupleService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Couple.name)   
        private readonly coupleModel: Model<CoupleDocument>,
        @InjectModel(CouplePeriod.name)
        private readonly couplePeriodModel: Model<CouplePeriodDocument>
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
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const partner = await this.userModel.findOne({ code });
        if (!partner) {
            throw new NotFoundException('Partner not found');
        }

        const existingCouple = await this.coupleModel.findOne({

            $or: [
                { user_1: user._id },
                { user_2: user._id },
            ],
            status: CoupleStatus.ACTIVE,
        });

        const existingPartnerCouple = await this.coupleModel.findOne({
            $or: [
                { user_1: partner._id }, 
                { user_2: partner._id },
            ],
            status: CoupleStatus.ACTIVE,
        });

        if (existingCouple || existingPartnerCouple) {
            throw new ConflictException('Either you or your partner is already in an active couple');
        }

        let couple = await this.coupleModel.findOne({
            $and: [
                {
                    $or: [
                        { user_1: user._id },
                        { user_2: user._id },
                    ]
                },
                {
                    $or: [
                        { user_1: partner._id },
                        { user_2: partner._id },
                    ]
                }
            ]
        });
        if (couple) {
            couple.user_1 = user._id;
            couple.user_2 = partner._id;
            couple.status = CoupleStatus.ACTIVE;
            await couple.save();
        }
        else {
            couple = new this.coupleModel({
                user_1: user._id,
                user_2: partner._id,
                status: CoupleStatus.ACTIVE,
            });
            await couple.save();
        }

        const period = new this.couplePeriodModel({
            start_date: new Date(),
            end_date: new Date(),
            couple: couple._id,
            status: CoupleStatus.ACTIVE,
        })
        await period.save();

        return couple;
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

    public async getLoveDays(userId: string): Promise<{ loveDays: number } | null> {
        // throw new NotFoundException('Not implemented yet');
        const userObjectId = new Types.ObjectId(userId);
        const couple = await this.coupleModel.findOne({
            $or: [
                { user_1: userObjectId },
                { user_2: userObjectId },
            ],
            status: CoupleStatus.ACTIVE,
        });

        if (!couple) {
            throw new NotFoundException('Couple not found');
        }

        const periods = await this.couplePeriodModel.find({ couple: couple._id});

        let loveDays = 0;
        const today = new Date();

        for (const period of periods) {
            const startDate = new Date(period.start_date);
            const endDate = (period.status === CoupleStatus.BROKEN_UP) ? new Date(period.end_date) : today;
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            loveDays += diffDays;
        }

        return { loveDays };
    }

    public async unlinkCouple(userId: string): Promise<Couple | null> {
        // throw new NotFoundException('Not implemented yet');
        const userObjectId = new Types.ObjectId(userId);
        const couple = await this.coupleModel.findOne({
            $or: [
                { user_1: userObjectId },
                { user_2: userObjectId },
            ],
            status: CoupleStatus.ACTIVE,
        });

        if (!couple) {
            throw new NotFoundException('Couple not found');
        }

        const period = await this.couplePeriodModel.findOne({ couple: couple._id, status: CoupleStatus.ACTIVE });
        if (period) {
            period.end_date = new Date();
            period.status = CoupleStatus.BROKEN_UP;
            await period.save();

            couple.status = CoupleStatus.BROKEN_UP;
            await couple.save();
        }
        else 
        {
            throw new NotFoundException('Couple period not found');
        }
        return couple;
    }

    public async getMyCouple(userId: string): Promise<Object | null> {
        // throw new NotFoundException('Not implemented yet');
        const userObjectId = new Types.ObjectId(userId);

        const couple = await this.coupleModel.findOne({
            $or: [
                { user_1: userObjectId },
                { user_2: userObjectId },
            ],
            status: CoupleStatus.ACTIVE,
        }).populate('user_1', 'name email avatar').populate('user_2', 'name email avatar');
        
        if (!couple) {
            throw new NotFoundException('Couple not found');
        }

        const user : any = (couple.user_1._id.equals(userObjectId)) ? couple.user_1 : couple.user_2;
        const partner : any = (couple.user_1._id.equals(userObjectId)) ? couple.user_2 : couple.user_1;

        return {
            coupleId: couple._id,
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
        };
    }
}