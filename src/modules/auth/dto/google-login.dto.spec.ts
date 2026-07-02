import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GoogleLoginDto } from './google-login.dto';

describe('GoogleLoginDto', () => {
  it('accepts the Firebase ID token and profile fallback fields', async () => {
    const dto = plainToInstance(GoogleLoginDto, {
      firebaseIdToken: 'firebase-id-token',
      name: 'Love Sync',
      avatar: 'https://example.com/avatar.jpg',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('requires both name and a valid avatar URL', async () => {
    const dto = plainToInstance(GoogleLoginDto, {
      firebaseIdToken: 'firebase-id-token',
      name: '',
      avatar: 'not-a-url',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'avatar']),
    );
  });
});
