import { IsNotEmpty, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @MinLength(6)
  passwordConfirm: string;
}
