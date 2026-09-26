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

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Enrolled program UUID',
    nullable: true,
  })
  currentProgramId?: string | null;

  @ApiPropertyOptional({
    example: '2026-09-21T00:00:00.000Z',
    description: 'Date when user started current program in ISO 8601 UTC format',
    nullable: true,
  })
  programStartDate?: string | null;

  @ApiPropertyOptional({
    example: 'MALE',
    description: 'Biological gender for metabolic calculations',
    nullable: true,
  })
  gender?: string | null;

  @ApiPropertyOptional({
    example: '1995-05-15T00:00:00.000Z',
    description: 'Birth date in ISO format',
    nullable: true,
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    example: 175.5,
    description: 'Height in cm',
    nullable: true,
  })
  heightCm?: number | null;

  @ApiPropertyOptional({
    example: 75.0,
    description: 'Target weight in kg',
    nullable: true,
  })
  targetWeightKg?: number | null;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarAssetName: user.avatarAssetName,
      goalType: user.goalType,
      joinDate: user.joinDate.toISOString(),
      role: user.role,
      currentProgramId: user.currentProgramId,
      programStartDate: user.programStartDate
        ? user.programStartDate.toISOString()
        : null,
      gender: user.gender ?? null,
      birthDate: user.birthDate ? user.birthDate.toISOString() : null,
      heightCm: user.heightCm ?? null,
      targetWeightKg: user.targetWeightKg ?? null,
    };
  }
}
