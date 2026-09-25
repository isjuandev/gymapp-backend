import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityDailySnapshotResponseDto {
  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Unique identifier for the activity daily snapshot',
  })
  id: string;

  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'User ID owner of this snapshot',
  })
  userId: string;

  @ApiProperty({
    example: '2026-09-24T00:00:00.000Z',
    description: 'Snapshot date in ISO 8601 UTC format',
  })
  date: string;

  @ApiProperty({
    example: 8450,
    description: 'Steps recorded for the day',
  })
  steps: number;

  @ApiProperty({
    example: 10000,
    description: 'Daily step goal',
  })
  stepsGoal: number;

  @ApiProperty({
    example: 450.5,
    description: 'Active kilocalories burned',
  })
  caloriesActive: number;

  @ApiProperty({
    example: 7.5,
    description: 'Sleep duration in hours',
  })
  sleepHours: number;

  @ApiPropertyOptional({
    example: 72,
    nullable: true,
    description: 'Average resting or daily heart rate in bpm',
  })
  avgHeartRate: number | null;

  @ApiProperty({
    example: 6.2,
    description: 'Distance covered in kilometers',
  })
  distanceKm: number;
}
