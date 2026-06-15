import { Module } from "@nestjs/common";
import { UserModule } from "../users/user.module";
import { MongooseModule } from "@nestjs/mongoose";
import { Device, DeviceSchema } from "./schema/device.schema";
import { DeviceController } from "./device.controller";
import { DeviceService } from "./device.service";

@Module(
    {
        imports : [
            UserModule,
            MongooseModule.forFeature([
                {
                    name: Device.name,
                    schema: DeviceSchema
                }
            ])
        ],
        exports: [
            MongooseModule
        ],
        controllers: [
            DeviceController
        ],
        providers: [
            DeviceService
        ]

    }
)
export class DeviceModule{}