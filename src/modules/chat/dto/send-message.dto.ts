import { Type } from 'class-transformer';
import {
  Equals,
  IsArray,
  IsBase64,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MessageEncryptionAlgorithm } from '../../e2ee/enum/e2ee-algorithm.enum';

export class EncryptedMessageDto {
  @Equals(MessageEncryptionAlgorithm.RSA_OAEP_256_A256GCM)
  algorithm: MessageEncryptionAlgorithm.RSA_OAEP_256_A256GCM;

  @IsBase64()
  @MaxLength(131072)
  ciphertext: string;

  @IsBase64()
  @MaxLength(128)
  iv: string;

  @IsBase64()
  @MaxLength(128)
  authTag: string;

  @IsBase64()
  @MaxLength(2048)
  senderEncryptedKey: string;

  @IsBase64()
  @MaxLength(2048)
  recipientEncryptedKey: string;

  @IsInt()
  @Min(1)
  senderKeyVersion: number;

  @IsInt()
  @Min(1)
  recipientKeyVersion: number;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedMessageDto)
  encryption?: EncryptedMessageDto;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachments?: string[]; // này là các file được upload lên server, server sẽ trả về url của các file này và lưu vào đây

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  attachmentUrls?: string[]; // này là các url của các file đã được upload lên server trước đó, ví dụ như các file đã được gửi trong các tin nhắn trước đó, hoặc các file được lưu trữ trên server từ trước, và người dùng muốn gửi lại chúng trong tin nhắn mới
}
