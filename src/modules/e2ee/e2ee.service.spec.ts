import { ConflictException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { CoupleDocument } from '../couples/schemas/couple.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { SetupE2eeKeysDto } from './dto/setup-e2ee-keys.dto';
import { E2eeService } from './e2ee.service';
import {
  E2eeKeyAlgorithm,
  PrivateKeyEncryptionAlgorithm,
  RecoveryKeyDerivationAlgorithm,
} from './enum/e2ee-algorithm.enum';
import {
  E2eeKeyBundle,
  E2eeKeyBundleDocument,
} from './schemas/e2ee-key-bundle.schema';

describe('E2eeService', () => {
  const userId = new Types.ObjectId().toString();
  const dto: SetupE2eeKeysDto = {
    publicKey: {
      kty: 'RSA',
      alg: E2eeKeyAlgorithm.RSA_OAEP_256,
      n: Buffer.alloc(256, 1).toString('base64url'),
      e: 'AQAB',
      use: 'enc',
    },
    encryptedPrivateKey: {
      algorithm: PrivateKeyEncryptionAlgorithm.AES_256_GCM,
      kdf: RecoveryKeyDerivationAlgorithm.PBKDF2_SHA256,
      iterations: 600000,
      salt: Buffer.alloc(16, 2).toString('base64'),
      iv: Buffer.alloc(12, 3).toString('base64'),
      authTag: Buffer.alloc(16, 4).toString('base64'),
      ciphertext: Buffer.from('encrypted-private-key').toString('base64'),
    },
  };
  let keyBundleModel: {
    exists: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let coupleModel: { findOne: jest.Mock };
  let userModel: { updateOne: jest.Mock };
  let service: E2eeService;

  beforeEach(() => {
    keyBundleModel = {
      exists: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    coupleModel = { findOne: jest.fn() };
    userModel = { updateOne: jest.fn() };
    service = new E2eeService(
      keyBundleModel as unknown as Model<E2eeKeyBundleDocument>,
      coupleModel as unknown as Model<CoupleDocument>,
      userModel as unknown as Model<UserDocument>,
    );
  });

  it('stores only the public key and encrypted private-key backup', async () => {
    keyBundleModel.exists.mockResolvedValue(null);
    const createdAt = new Date();
    keyBundleModel.create.mockResolvedValue({
      user: new Types.ObjectId(userId),
      keyVersion: 1,
      publicKey: dto.publicKey,
      encryptedPrivateKey: dto.encryptedPrivateKey,
      createdAt,
      updatedAt: createdAt,
    } satisfies Partial<E2eeKeyBundle>);
    userModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await service.setup(userId, dto);

    expect(keyBundleModel.create).toHaveBeenCalledWith({
      user: new Types.ObjectId(userId),
      keyVersion: 1,
      publicKey: dto.publicKey,
      encryptedPrivateKey: dto.encryptedPrivateKey,
    });
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: userId },
      { $set: { hasE2eeKeys: true } },
    );
    expect(result).not.toHaveProperty('encryptedPrivateKey');
  });

  it('does not allow replacing an existing key bundle', async () => {
    keyBundleModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    await expect(service.setup(userId, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(keyBundleModel.create).not.toHaveBeenCalled();
  });
});
