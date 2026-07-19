import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetupE2eeKeysDto } from './setup-e2ee-keys.dto';

describe('SetupE2eeKeysDto', () => {
  const validPayload = {
    publicKey: {
      kty: 'RSA',
      alg: 'RSA-OAEP-256',
      n: Buffer.alloc(256, 1).toString('base64url'),
      e: 'AQAB',
      use: 'enc',
    },
    encryptedPrivateKey: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-HMAC-SHA256',
      iterations: 600000,
      salt: Buffer.alloc(16, 2).toString('base64'),
      iv: Buffer.alloc(12, 3).toString('base64'),
      authTag: Buffer.alloc(16, 4).toString('base64'),
      ciphertext: Buffer.from('encrypted-private-key').toString('base64'),
    },
  };

  it('accepts an encrypted private-key backup without a recovery code', async () => {
    const dto = plainToInstance(SetupE2eeKeysDto, validPayload);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects sending the six-digit recovery code to the server', async () => {
    const dto = plainToInstance(SetupE2eeKeysDto, {
      ...validPayload,
      recoveryCode: '123456',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((error) => error.property === 'recoveryCode')).toBe(
      true,
    );
  });
});
