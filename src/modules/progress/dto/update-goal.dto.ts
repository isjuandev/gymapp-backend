import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { GoalType } from '@prisma/client';

export class UpdateGoalDto {
  @ApiPropertyOptional({
    enum: GoalType,
    example: GoalType.LOSE_WEIGHT,
    description: 'Updated goal type',
  })
  @IsOptional()
  @IsEnum(GoalType, {
    message: 'type must be one of: LOSE_WEIGHT, GAIN_MUSCLE, IMPROVE_HEALTH',
  })
  type?: GoalType;
  @ApiPropertyOptional({
    example: 75.0,
    description: 'Updated current progress metric value',
  })
  @IsOptional()
  @IsNumber({}, { message: 'currentValue must be a number' })
  @IsPositive({ message: 'currentValue must be greater than 0' })
  currentValue?: number;

  @ApiPropertyOptional({
    example: 68.0,
    description: 'Updated target metric value',
  })
  @IsOptional()
  @IsNumber({}, { message: 'targetValue must be a number' })
  @IsPositive({ message: 'targetValue must be greater than 0' })
  targetValue?: number;

  @ApiPropertyOptional({
    example: '2027-01-31T23:59:59.000Z',
    description: 'Updated deadline in ISO 8601 format',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'deadline must be a valid ISO 8601 date string' },
  )
  deadline?: string;
}
