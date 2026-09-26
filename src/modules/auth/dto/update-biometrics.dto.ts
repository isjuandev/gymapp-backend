import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Gender, GoalType } from '@prisma/client';

export class UpdateBiometricsDto {
  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE, description: 'Biological gender for BMR calculations' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '1995-05-15T00:00:00.000Z', description: 'Birth date in ISO format' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 178.0, description: 'Height in cm (100 - 250)' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(250)
  heightCm?: number;

  @ApiPropertyOptional({ example: 82.5, description: 'Current weight in kg (30 - 300)' })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  currentWeightKg?: number;

  @ApiPropertyOptional({ example: 75.0, description: 'Target weight in kg (30 - 300)' })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  targetWeightKg?: number;

  @ApiPropertyOptional({ enum: GoalType, example: GoalType.LOSE_WEIGHT, description: 'Updated fitness goal' })
  @IsOptional()
  @IsEnum(GoalType)
  goalType?: GoalType;
}
