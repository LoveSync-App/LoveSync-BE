import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  firebaseIdToken: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  avatar: string;
}
