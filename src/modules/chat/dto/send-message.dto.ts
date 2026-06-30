import {
    IsArray,
    IsOptional,
    IsString,
    IsUrl,
} from "class-validator";

export class SendMessageDto {
    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    attachments?: string[]; // này là các file được upload lên server, server sẽ trả về url của các file này và lưu vào đây

    @IsOptional()
    @IsArray()
    @IsUrl({}, { each: true })
    attachmentUrls?: string[]; // này là các url của các file đã được upload lên server trước đó, ví dụ như các file đã được gửi trong các tin nhắn trước đó, hoặc các file được lưu trữ trên server từ trước, và người dùng muốn gửi lại chúng trong tin nhắn mới
}
