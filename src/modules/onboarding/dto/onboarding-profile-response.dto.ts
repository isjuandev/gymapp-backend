import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExperienceLevel, GoalType } from '@prisma/client';

export class OnboardingProfileResponseDto {
  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Unique identifier for the onboarding profile',
  })
  id: string;

  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'Associated user ID',
  })
  userId: string;

  @ApiProperty({
    enum: GoalType,
    example: GoalType.LOSE_WEIGHT,
    description: 'Selected primary fitness goal',
  })
  goal: GoalType;

  @ApiProperty({
    enum: ExperienceLevel,
    example: ExperienceLevel.INTERMEDIATE,
    description: 'Selected experience level',
  })
  experienceLevel: ExperienceLevel;

  @ApiProperty({
    example: 4,
    description: 'Workout days per week target',
  })
  workoutDaysPerWeek: number;

  @ApiPropertyOptional({
    example: '2026-09-24T12:00:00.000Z',
    nullable: true,
    description: 'Timestamp when onboarding was completed',
  })
  completedAt: string | null;

  @ApiPropertyOptional({
    example: [
      '88888888-8888-4888-8888-888888888881',
      '88888888-8888-4888-8888-888888888882',
    ],
    description: 'Configured equipment preference IDs',
  })
  equipmentIds?: string[];
}
