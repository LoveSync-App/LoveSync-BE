import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Album, AlbumSchema } from "./schemas/album.schema";
import { Memory, MemorySchema } from "./schemas/memory.schema";

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Album.name,
                schema: AlbumSchema
            },
            {
                name: Memory.name,
                schema: MemorySchema
            }
        ])
    ],
    exports: [
        MongooseModule
    ]
})
export class AlbumModule{}