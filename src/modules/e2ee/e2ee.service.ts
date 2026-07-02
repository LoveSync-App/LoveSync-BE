import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoupleStatus } from '../couples/enum/couple-status.enum';
import { Couple, CoupleDocument } from '../couples/schemas/couple.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SetupE2eeKeysDto } from './dto/setup-e2ee-keys.dto';
import {
  E2eeKeyBundle,
  E2eeKeyBundleDocument,
} from './schemas/e2ee-key-bundle.schema';

@Injectable()
export class E2eeService {
  constructor(
    @InjectModel(E2eeKeyBundle.name)
    private readonly keyBundleModel: Model<E2eeKeyBundleDocument>,
    @InjectModel(Couple.name)
    private readonly coupleModel: Model<CoupleDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async setup(userId: string, dto: SetupE2eeKeysDto) {
    this.validateKeyMaterial(dto);
    const existing = await this.keyBundleModel.exists({
      user: new Types.ObjectId(userId),
    });
    if (existing) {
      throw new ConflictException('E2EE keys are already configured');
    }

    let bundle: E2eeKeyBundleDocument;
    try {
      bundle = await this.keyBundleModel.create({
        user: new Types.ObjectId(userId),
        keyVersion: 1,
        publicKey: dto.publicKey,
        encryptedPrivateKey: dto.encryptedPrivateKey,
      });
    } catch (error) {
      if (this.isMongoDuplicateKeyError(error)) {
        throw new ConflictException('E2EE keys are already configured');
      }
      throw error;
    }

    await this.userModel.updateOne(
      { _id: userId },
      { $set: { hasE2eeKeys: true } },
    );
    return this.toPublicKeyResponse(bundle);
  }

  async getMyKeys(userId: string) {
    const bundle = await this.keyBundleModel
      .findOne({ user: new Types.ObjectId(userId) })
      .select('+encryptedPrivateKey');
    if (!bundle) {
      throw new NotFoundException('E2EE keys are not configured');
    }
    return {
      ...this.toPublicKeyResponse(bundle),
      encryptedPrivateKey: bundle.encryptedPrivateKey,
    };
  }

  async getPartnerPublicKey(userId: string) {
    const partnerId = await this.getPartnerId(userId);
    const bundle = await this.keyBundleModel.findOne({ user: partnerId });
    if (!bundle) {
      throw new NotFoundException('Partner has not configured E2EE keys');
    }
    return this.toPublicKeyResponse(bundle);
  }

  async getPairKeyVersions(userId: string, partnerId: Types.ObjectId) {
    const bundles = await this.keyBundleModel
      .find({
        user: {
          $in: [new Types.ObjectId(userId), partnerId],
        },
      })
      .select('user keyVersion')
      .lean();
    const versions = new Map(
      bundles.map((bundle) => [bundle.user.toString(), bundle.keyVersion]),
    );
    return {
      senderKeyVersion: versions.get(userId),
      recipientKeyVersion: versions.get(partnerId.toString()),
    };
  }

  private async getPartnerId(userId: string) {
    const objectUserId = new Types.ObjectId(userId);
    const couple = await this.coupleModel
      .findOne({
        $or: [{ user_1: objectUserId }, { user_2: objectUserId }],
        status: CoupleStatus.ACTIVE,
      })
      .select('user_1 user_2')
      .lean();
    if (!couple) {
      throw new NotFoundException('Active couple not found');
    }
    return couple.user_1.equals(objectUserId) ? couple.user_2 : couple.user_1;
  }

  private toPublicKeyResponse(bundle: E2eeKeyBundleDocument) {
    return {
      userId: bundle.user.toString(),
      keyVersion: bundle.keyVersion,
      publicKey: bundle.publicKey,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    };
  }

  private validateKeyMaterial(dto: SetupE2eeKeysDto) {
    const modulusBytes = Buffer.from(dto.publicKey.n, 'base64url').length;
    const saltBytes = Buffer.from(
      dto.encryptedPrivateKey.salt,
      'base64',
    ).length;
    const ivBytes = Buffer.from(dto.encryptedPrivateKey.iv, 'base64').length;
    const authTagBytes = Buffer.from(
      dto.encryptedPrivateKey.authTag,
      'base64',
    ).length;

    if (modulusBytes < 256) {
      throw new BadRequestException(
        'RSA public key must be at least 2048 bits',
      );
    }
    if (saltBytes < 16) {
      throw new BadRequestException('PBKDF2 salt must be at least 16 bytes');
    }
    if (ivBytes !== 12) {
      throw new BadRequestException('AES-GCM IV must be exactly 12 bytes');
    }
    if (authTagBytes !== 16) {
      throw new BadRequestException(
        'AES-GCM authentication tag must be exactly 16 bytes',
      );
    }
  }

  private isMongoDuplicateKeyError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
