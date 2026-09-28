import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ExperienceLevel, Gender, GoalType } from '@prisma/client';

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

  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.MALE,
    description: 'Biological gender for nutritional/BMR calculations',
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'gender must be one of: MALE, FEMALE, OTHER' })
  gender?: Gender;

  @ApiPropertyOptional({
    example: '1995-05-15T00:00:00.000Z',
    description: 'Birth date in ISO format',
  })
  @IsOptional()
  @IsDateString({}, { message: 'birthDate must be a valid ISO date string' })
  birthDate?: string;

  @ApiPropertyOptional({
    example: 178.0,
    description: 'Height in cm (100 - 250)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'heightCm must be a number' })
  @Min(100, { message: 'heightCm must be at least 100' })
  @Max(250, { message: 'heightCm cannot exceed 250' })
  heightCm?: number;

  @ApiPropertyOptional({
    example: 82.5,
    description: 'Current body weight in kg (30 - 300)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'currentWeightKg must be a number' })
  @Min(30, { message: 'currentWeightKg must be at least 30' })
  @Max(300, { message: 'currentWeightKg cannot exceed 300' })
  currentWeightKg?: number;

  @ApiPropertyOptional({
    example: 75.0,
    description: 'Target body weight in kg (30 - 300)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'targetWeightKg must be a number' })
  @Min(30, { message: 'targetWeightKg must be at least 30' })
  @Max(300, { message: 'targetWeightKg cannot exceed 300' })
  targetWeightKg?: number;
}

