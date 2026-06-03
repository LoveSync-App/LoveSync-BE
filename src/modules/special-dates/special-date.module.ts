import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SpecialDate, SpecialDateSchema } from "./schemas/special-date.schema";

@Module({
    imports:[
        MongooseModule.forFeature([
            {
                name: SpecialDate.name,
                schema: SpecialDateSchema
            }
        ])
    ],
    exports: [
        MongooseModule
    ]
})
export class SpecialDateModule{}