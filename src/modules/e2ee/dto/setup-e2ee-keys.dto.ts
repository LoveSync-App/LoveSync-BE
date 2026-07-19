import { Type } from 'class-transformer';
import {
  Equals,
  IsBase64,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  E2eeKeyAlgorithm,
  PrivateKeyEncryptionAlgorithm,
  RecoveryKeyDerivationAlgorithm,
} from '../enum/e2ee-algorithm.enum';

export class RsaPublicKeyJwkDto {
  @Equals('RSA')
  kty: 'RSA';

  @Equals(E2eeKeyAlgorithm.RSA_OAEP_256)
  alg: E2eeKeyAlgorithm.RSA_OAEP_256;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MinLength(342)
  @MaxLength(4096)
  n: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MaxLength(16)
  e: string;

  @IsOptional()
  @Equals('enc')
  use?: 'enc';
}

export class EncryptedPrivateKeyDto {
  @Equals(PrivateKeyEncryptionAlgorithm.AES_256_GCM)
  algorithm: PrivateKeyEncryptionAlgorithm.AES_256_GCM;

  @Equals(RecoveryKeyDerivationAlgorithm.PBKDF2_SHA256)
  kdf: RecoveryKeyDerivationAlgorithm.PBKDF2_SHA256;

  @IsInt()
  @Min(100000)
  @Max(2000000)
  iterations: number;

  @IsBase64()
  @MaxLength(256)
  salt: string;

  @IsBase64()
  @MaxLength(128)
  iv: string;

  @IsBase64()
  @MaxLength(128)
  authTag: string;

  @IsBase64()
  @MaxLength(32768)
  ciphertext: string;
}

export class SetupE2eeKeysDto {
  @ValidateNested()
  @Type(() => RsaPublicKeyJwkDto)
  publicKey: RsaPublicKeyJwkDto;

  @ValidateNested()
  @Type(() => EncryptedPrivateKeyDto)
  encryptedPrivateKey: EncryptedPrivateKeyDto;
}
