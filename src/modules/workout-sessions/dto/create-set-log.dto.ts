import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSetLogDto {
  @ApiProperty({
    description: 'UUID of the exercise being performed',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsUUID('all', { message: 'exerciseId must be a valid UUID' })
  @IsNotEmpty({ message: 'exerciseId is required' })
  exerciseId: string;

  @ApiProperty({
    description: 'Set number within this exercise (1-indexed)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'setNumber must be an integer' })
  @Min(1, { message: 'setNumber must be at least 1' })
  setNumber: number;

  @ApiProperty({
    description: 'Weight lifted in kilograms (0 for bodyweight exercises)',
    example: 40.0,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'weightKg must be a valid number' })
  @Min(0, { message: 'weightKg cannot be negative' })
  weightKg: number;

  @ApiProperty({
    description: 'Number of repetitions completed in this set',
    example: 12,
  })
  @Type(() => Number)
  @IsInt({ message: 'reps must be an integer' })
  @Min(0, { message: 'reps cannot be negative' })
  reps: number;

  @ApiPropertyOptional({
    description: 'Flag indicating whether this is a warmup set',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isWarmup must be a boolean' })
  isWarmup?: boolean = false;

  @ApiPropertyOptional({
    description: 'Rate of Perceived Exertion (RPE 1-10)',
    example: 8.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'rpe must be a number' })
  @Min(1, { message: 'rpe must be at least 1' })
  @Max(10, { message: 'rpe cannot exceed 10' })
  rpe?: number;
}
