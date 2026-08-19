import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
