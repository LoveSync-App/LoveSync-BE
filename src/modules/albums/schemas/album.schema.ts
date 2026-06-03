import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Couple } from "../../couples/schemas/couple.schema";

export type AlbumDocument = HydratedDocument<Album>;

@Schema()
export class Album {
    @Prop({
        type: Types.ObjectId,
        ref: Couple.name,
    })
    couple: Types.ObjectId;

    @Prop()
    title: string;

    @Prop()
    description: string;
}

export const AlbumSchema = SchemaFactory.createForClass(Album);