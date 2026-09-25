import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4...',
    description: 'Current valid refresh token',
  })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken is required' })
  refreshToken: string;
}
