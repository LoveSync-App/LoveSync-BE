import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginRegisterDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @MinLength(6)
  passwordConfirm: string;
}
