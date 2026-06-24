import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateMemoryDto {
    @IsNotEmpty()
    file_url: string;

    @IsNotEmpty()
    title: string;

    @IsOptional()
    @IsDateString()
    time?: Date;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    emotion?: string;
}