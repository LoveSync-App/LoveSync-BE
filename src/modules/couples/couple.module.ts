import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Couple, CoupleSchema } from "./schemas/couple.schema";

@Module(
    {
        imports:[
            MongooseModule.forFeature([
                {
                    name: Couple.name,
                    schema: CoupleSchema
                }
            ])
        ],
        exports: [
            MongooseModule
        ]
    }
)
export class CoupleModule {}