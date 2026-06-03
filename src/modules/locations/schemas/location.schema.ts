import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { User } from "../../users/schemas/user.schema";

export type LocationDocument = HydratedDocument<Location>;

@Schema()
export class Location{
    @Prop({
        required: true,
        type: Types.ObjectId,
        ref: User.name
    })
    user: Types.ObjectId;

    @Prop({
        required: true,
        type: Number
    })
    latitude: number;

    @Prop({
        required: true,
        type: Number
    })
    longitude: number;
}

export const LocationSchema = SchemaFactory.createForClass(Location);