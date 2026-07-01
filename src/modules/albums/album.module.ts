import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Album, AlbumSchema } from "./schemas/album.schema";
import { Memory, MemorySchema } from "./schemas/memory.schema";
import { MemoryController } from "./memory.controller";
import { MemoryService } from "./memory.service";
import { UserModule } from "../users/user.module";
import { CoupleModule } from "../couples/couple.module";

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
        ]),
        UserModule,
        CoupleModule
    ],
    exports: [
        MongooseModule
    ],
    controllers: [
        MemoryController
    ],
    providers: [
        MemoryService
    ]
})
export class AlbumModule { }
