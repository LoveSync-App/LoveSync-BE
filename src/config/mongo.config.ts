import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";



@Module(
    {
        imports: [
            MongooseModule.forRootAsync(
                {
                    imports: [ConfigModule],
                    inject: [ConfigService],
                    useFactory: (configService: ConfigService) => (
                        {
                            uri: configService.get<string>('MONGO_URI'),
                            retryAttempts: 5,
                            retryDelay: 3000
                        }
                    )
                }
            )
        ]
    }
)
export class MongoConfigModule { }