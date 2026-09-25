import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Full name of the user',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Unique email address',
  })
  @IsEmail({}, { message: 'Must provide a valid email address' })
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description:
      'Password (min 8 characters, at least 1 uppercase letter and 1 number)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter and at least one number',
  })
  password: string;
}
