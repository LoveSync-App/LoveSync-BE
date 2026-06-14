import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Couple, CoupleSchema } from "./schemas/couple.schema";
import { CoupleController } from "./couple.controller";
import { CoupleService } from "./couple.service";
import { UserModule } from "../users/user.module";
import { CouplePeriod, CouplePeriodSchema } from "./schemas/couple_period.schema";

@Module(
    {
        imports:[
            MongooseModule.forFeature([
                {
                    name: Couple.name,
                    schema: CoupleSchema
                },
                {
                    name:CouplePeriod.name,
                    schema: CouplePeriodSchema
                }
            ]),
            UserModule
        ],
        exports: [
            MongooseModule
        ],
        controllers: [
            CoupleController
        ],
        providers: [
            CoupleService
        ]
    }
)
export class CoupleModule {}