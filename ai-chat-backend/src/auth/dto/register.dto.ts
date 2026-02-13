import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный формат email' })
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD, {
    message: `Пароль должен быть не короче ${MIN_PASSWORD} символов`,
  })
  @MaxLength(MAX_PASSWORD, {
    message: `Пароль не должен превышать ${MAX_PASSWORD} символов`,
  })
  password: string;
}
