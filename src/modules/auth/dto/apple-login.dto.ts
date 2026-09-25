import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({
    example: '001234.abcdef1234567890abcdef.1234',
    description: 'Unique persistent Apple user identifier',
  })
  @IsString()
  @IsNotEmpty({ message: 'userIdentifier is required' })
  userIdentifier: string;

  @ApiProperty({
    example: 'eyJraWQiOiJ...',
    description: 'JWT identity token issued by Apple',
  })
  @IsString()
  @IsNotEmpty({ message: 'identityToken is required' })
  identityToken: string;

  @ApiPropertyOptional({
    example: 'c123abc...',
    description: 'Authorization code issued by Apple',
  })
  @IsOptional()
  @IsString()
  authorizationCode?: string;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'User full name if provided by Apple or client cache',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'user@privaterelay.appleid.com',
    description: 'User email if provided by Apple or client cache',
  })
  @IsOptional()
  @IsString()
  email?: string;
}
