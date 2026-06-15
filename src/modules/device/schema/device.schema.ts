import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { User } from "../../users/schemas/user.schema";

export type DeviceDocument = HydratedDocument<Device>;


@Schema()
export class Device {
    @Prop(
        {
            type: Types.ObjectId,
            ref: User.name,
            required: true,
            unique: true,
        }
    )
    user: Types.ObjectId;

    @Prop()
    token: string;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);