import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Registered user email',
  })
  @IsEmail({}, { message: 'Must provide a valid email address' })
  email: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'User account password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
