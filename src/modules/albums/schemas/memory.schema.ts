import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Album } from "../../albums/schemas/album.schema";
import { HydratedDocument, Types } from "mongoose";
import { MemoryFileType } from "../enum/memory-file-type.enum";

export type AlbumDocument = HydratedDocument<Album>;

@Schema()
export class Memory {
    @Prop(
        {
            type: Types.ObjectId,
            ref: Album.name,
        }
    )
    album: Types.ObjectId;

    @Prop(
        {
            type: Types.ObjectId,
        }
    )
    uploader: Types.ObjectId;

    @Prop()
    file_url: string;

    @Prop(
        {
            type: String,
            enum: MemoryFileType,
            default: MemoryFileType.IMAGE,
        }
    )
    file_type: MemoryFileType;

    @Prop()
    description: string;
}

export const MemorySchema = SchemaFactory.createForClass(Memory);