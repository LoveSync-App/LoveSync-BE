import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Album } from "../../albums/schemas/album.schema";
import { HydratedDocument, Types } from "mongoose";
import { MemoryFileType } from "../enum/memory-file-type.enum";
import { Couple } from "../../couples/schemas/couple.schema";
import { User } from "../../users/schemas/user.schema";

export type MemoryDocument = HydratedDocument<Memory>;

@Schema()
export class Memory {
    // @Prop(
    //     {
    //         type: Types.ObjectId,
    //         ref: Album.name,
    //     }
    // )
    // album: Types.ObjectId;

    @Prop(
        {
            type: Types.ObjectId,
            ref: Couple.name,
        }
    )
    couple: Types.ObjectId;

    @Prop(
        {
            type: Types.ObjectId,
            ref: User.name,
        }
    )
    uploader: Types.ObjectId;

    @Prop()
    file_url: string;

    @Prop(
        {
            required: true,
        }
    )
    title: string;

    @Prop()
    description: string;

    @Prop({
        type: Date,
        default: Date.now,
    })
    created_at: Date;
    time: Date;

    @Prop(
        {
            type: String,
            default: 'Unknown Location'
        }
    )
    location: string;

    @Prop(
        {
            type: String,
            default: ''
        }
    )
    emotion: string;

    @Prop(
        {
            type: String,
            enum: MemoryFileType,
            default: MemoryFileType.IMAGE,
        }
    )
    file_type: MemoryFileType;
}

export const MemorySchema = SchemaFactory.createForClass(Memory);