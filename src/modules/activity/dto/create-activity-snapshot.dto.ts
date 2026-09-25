import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateActivityDailySnapshotDto {
  @ApiProperty({
    example: '2026-09-24T00:00:00.000Z',
    description: 'Date of the activity snapshot in ISO 8601 format',
  })
  @IsDateString({}, { message: 'date must be a valid ISO 8601 date string' })
  @IsNotEmpty({ message: 'date is required' })
  date: string;

  @ApiProperty({
    example: 8450,
    description: 'Total steps recorded for the day',
  })
  @IsInt({ message: 'steps must be an integer' })
  @Min(0, { message: 'steps must be greater than or equal to 0' })
  steps: number;

  @ApiProperty({
    example: 10000,
    description: 'User daily step target/goal',
  })
  @IsInt({ message: 'stepsGoal must be an integer' })
  @Min(0, { message: 'stepsGoal must be greater than or equal to 0' })
  stepsGoal: number;

  @ApiProperty({
    example: 450.5,
    description: 'Active energy burned in kilocalories',
  })
  @IsNumber({}, { message: 'caloriesActive must be a number' })
  @Min(0, { message: 'caloriesActive must be greater than or equal to 0' })
  caloriesActive: number;

  @ApiProperty({
    example: 7.5,
    description: 'Total sleep duration in hours',
  })
  @IsNumber({}, { message: 'sleepHours must be a number' })
  @Min(0, { message: 'sleepHours must be greater than or equal to 0' })
  sleepHours: number;

  @ApiPropertyOptional({
    example: 72,
    description: 'Average resting or daily heart rate in beats per minute',
  })
  @IsOptional()
  @IsInt({ message: 'avgHeartRate must be an integer' })
  @Min(0, { message: 'avgHeartRate must be greater than or equal to 0' })
  avgHeartRate?: number;

  @ApiProperty({
    example: 6.2,
    description: 'Total walking/running distance in kilometers',
  })
  @IsNumber({}, { message: 'distanceKm must be a number' })
  @Min(0, { message: 'distanceKm must be greater than or equal to 0' })
  distanceKm: number;
}
