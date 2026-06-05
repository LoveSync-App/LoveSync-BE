import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Couple, CoupleSchema } from "./schemas/couple.schema";
import { CoupleController } from "./couple.controller";
import { CoupleService } from "./couple.service";
import { UserModule } from "../users/user.module";

@Module(
    {
        imports:[
            MongooseModule.forFeature([
                {
                    name: Couple.name,
                    schema: CoupleSchema
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