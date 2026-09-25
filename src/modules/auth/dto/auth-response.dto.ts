import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT short-lived access token (expires in 15 minutes)',
  })
  accessToken: string;

  @ApiProperty({
    example: 'dGhpcy1pcy1hLXNlY3VyZS1yZWZyZXNoLXRva2Vu...',
    description: 'Long-lived refresh token (expires in 30 days)',
  })
  refreshToken: string;

  @ApiProperty({
    type: () => UserResponseDto,
    description: 'Public profile information of the authenticated user',
  })
  user: UserResponseDto;
}
