import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalType, User, UserRole } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Unique user identifier (UUID)',
  })
  id: string;

  @ApiProperty({
    example: 'Juan Pérez',
    description: 'User full name',
  })
  name: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiPropertyOptional({
    example: 'avatar_user1',
    description: 'Identifier/asset name of the avatar in the iOS client bundle',
    nullable: true,
  })
  avatarAssetName: string | null;

  @ApiPropertyOptional({
    enum: GoalType,
    example: GoalType.LOSE_WEIGHT,
    description: 'Primary fitness goal of the user',
    nullable: true,
  })
  goalType: GoalType | null;

  @ApiProperty({
    example: '2026-09-24T21:30:00.000Z',
    description: 'Registration timestamp in ISO 8601 UTC format',
  })
  joinDate: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.MEMBER,
    description: 'Access role in the system',
  })
  role: UserRole;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarAssetName: user.avatarAssetName,
      goalType: user.goalType,
      joinDate: user.joinDate.toISOString(),
      role: user.role,
    };
  }
}
