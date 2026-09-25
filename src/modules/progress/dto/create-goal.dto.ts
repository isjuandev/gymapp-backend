import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { GoalType } from '@prisma/client';

export class CreateGoalDto {
  @ApiProperty({
    enum: GoalType,
    example: GoalType.LOSE_WEIGHT,
    description:
      'Type of the fitness goal (LOSE_WEIGHT, GAIN_MUSCLE, IMPROVE_HEALTH)',
  })
  @IsEnum(GoalType, {
    message: 'type must be one of: LOSE_WEIGHT, GAIN_MUSCLE, IMPROVE_HEALTH',
  })
  @IsNotEmpty({ message: 'type is required' })
  type: GoalType;

  @ApiProperty({
    example: 70.0,
    description: 'Target metric value (e.g. target body weight in kg)',
  })
  @IsNumber({}, { message: 'targetValue must be a number' })
  @IsPositive({ message: 'targetValue must be greater than 0' })
  targetValue: number;

  @ApiProperty({
    example: 78.5,
    description: 'Starting / current metric value at goal creation',
  })
  @IsNumber({}, { message: 'currentValue must be a number' })
  @IsPositive({ message: 'currentValue must be greater than 0' })
  currentValue: number;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Optional target completion deadline in ISO 8601 format',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'deadline must be a valid ISO 8601 date string' },
  )
  deadline?: string;
}
