import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class CompleteWorkoutSessionDto {
  @ApiProperty({
    example: 2850,
    description: 'Actual elapsed workout duration in seconds',
  })
  @IsInt()
  @IsPositive({ message: 'durationActualSeconds must be a positive integer' })
  durationActualSeconds: number;

  @ApiProperty({
    example: 410,
    description: 'Total active kilocalories burned',
  })
  @IsInt()
  @Min(0, { message: 'kcalBurned cannot be negative' })
  kcalBurned: number;

  @ApiPropertyOptional({
    example: 138,
    description: 'Average heart rate in bpm captured during session',
  })
  @IsOptional()
  @IsInt()
  @IsPositive({ message: 'avgHeartRate must be a positive integer' })
  avgHeartRate?: number;
}
