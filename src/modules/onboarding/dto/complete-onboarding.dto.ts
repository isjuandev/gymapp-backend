import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ExperienceLevel, GoalType } from '@prisma/client';

export class CompleteOnboardingDto {
  @ApiProperty({
    enum: GoalType,
    example: GoalType.LOSE_WEIGHT,
    description:
      'Primary fitness goal (LOSE_WEIGHT, GAIN_MUSCLE, IMPROVE_HEALTH)',
  })
  @IsEnum(GoalType, {
    message: 'goal must be one of: LOSE_WEIGHT, GAIN_MUSCLE, IMPROVE_HEALTH',
  })
  @IsNotEmpty({ message: 'goal is required' })
  goal: GoalType;

  @ApiProperty({
    enum: ExperienceLevel,
    example: ExperienceLevel.INTERMEDIATE,
    description:
      'Current training experience level (BEGINNER, INTERMEDIATE, ADVANCED)',
  })
  @IsEnum(ExperienceLevel, {
    message: 'experienceLevel must be one of: BEGINNER, INTERMEDIATE, ADVANCED',
  })
  @IsNotEmpty({ message: 'experienceLevel is required' })
  experienceLevel: ExperienceLevel;

  @ApiProperty({
    example: 4,
    description: 'Target workout frequency per week (between 1 and 7)',
  })
  @IsInt({ message: 'workoutDaysPerWeek must be an integer' })
  @Min(1, { message: 'workoutDaysPerWeek must be at least 1 day' })
  @Max(7, { message: 'workoutDaysPerWeek cannot exceed 7 days' })
  workoutDaysPerWeek: number;

  @ApiProperty({
    example: [
      '88888888-8888-4888-8888-888888888881',
      '88888888-8888-4888-8888-888888888882',
    ],
    description: 'List of equipment IDs available/preferred by the user',
  })
  @IsArray({ message: 'equipmentIds must be an array' })
  @IsUUID('4', {
    each: true,
    message: 'Each equipmentId must be a valid UUID v4',
  })
  equipmentIds: string[];
}
