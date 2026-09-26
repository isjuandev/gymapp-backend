import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CompleteWorkoutSessionDto {
  @ApiPropertyOptional({
    example: 2850,
    description:
      'Actual elapsed workout duration in seconds. If 0, null, or omitted, automatically derived from logged sets or workout template.',
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'durationActualSeconds must be an integer' })
  @Min(0, { message: 'durationActualSeconds cannot be negative' })
  durationActualSeconds?: number | null;

  @ApiPropertyOptional({
    example: 410,
    description:
      'Total active kilocalories burned. If 0, null, or omitted, automatically derived from workout template or duration.',
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'kcalBurned must be an integer' })
  @Min(0, { message: 'kcalBurned cannot be negative' })
  kcalBurned?: number | null;

  @ApiPropertyOptional({
    example: 138,
    description: 'Average heart rate in bpm captured during session',
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'avgHeartRate must be an integer' })
  @Min(0, { message: 'avgHeartRate cannot be negative' })
  avgHeartRate?: number | null;
}
