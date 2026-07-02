import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import {
  E2eeKeyAlgorithm,
  PrivateKeyEncryptionAlgorithm,
  RecoveryKeyDerivationAlgorithm,
} from '../enum/e2ee-algorithm.enum';

@Schema({ _id: false })
export class RsaPublicKeyJwk {
  @Prop({ required: true, type: String, enum: ['RSA'] })
  kty: 'RSA';

  @Prop({ required: true, type: String, enum: E2eeKeyAlgorithm })
  alg: E2eeKeyAlgorithm.RSA_OAEP_256;

  @Prop({ required: true })
  n: string;

  @Prop({ required: true })
  e: string;

  @Prop({ type: String, enum: ['enc'] })
  use?: 'enc';
}

const RsaPublicKeyJwkSchema = SchemaFactory.createForClass(RsaPublicKeyJwk);

@Schema({ _id: false })
export class EncryptedPrivateKey {
  @Prop({
    required: true,
    type: String,
    enum: PrivateKeyEncryptionAlgorithm,
  })
  algorithm: PrivateKeyEncryptionAlgorithm.AES_256_GCM;

  @Prop({
    required: true,
    type: String,
    enum: RecoveryKeyDerivationAlgorithm,
  })
  kdf: RecoveryKeyDerivationAlgorithm.PBKDF2_SHA256;

  @Prop({ required: true, min: 100000, max: 2000000 })
  iterations: number;

  @Prop({ required: true })
  salt: string;

  @Prop({ required: true })
  iv: string;

  @Prop({ required: true })
  authTag: string;

  @Prop({ required: true })
  ciphertext: string;
}

const EncryptedPrivateKeySchema =
  SchemaFactory.createForClass(EncryptedPrivateKey);

export type E2eeKeyBundleDocument = HydratedDocument<E2eeKeyBundle>;

@Schema({ timestamps: true, versionKey: false })
export class E2eeKeyBundle {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: User.name,
    unique: true,
    index: true,
  })
  user: Types.ObjectId;

  @Prop({ required: true, default: 1, min: 1 })
  keyVersion: number;

  @Prop({ required: true, type: RsaPublicKeyJwkSchema })
  publicKey: RsaPublicKeyJwk;

  @Prop({
    required: true,
    type: EncryptedPrivateKeySchema,
    select: false,
  })
  encryptedPrivateKey: EncryptedPrivateKey;

  createdAt: Date;
  updatedAt: Date;
}

export const E2eeKeyBundleSchema = SchemaFactory.createForClass(E2eeKeyBundle);
