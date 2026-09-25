import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Workout, WorkoutSession, WorkoutSessionStatus } from '@prisma/client';
import { WorkoutResponseDto } from '../../workouts/dto/workout-response.dto';

export class WorkoutSessionResponseDto {
  @ApiProperty({
    example: '77777777-7777-4777-8777-777777777771',
    description: 'Unique workout session UUID',
  })
  id: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Owner user UUID',
  })
  userId: string;

  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222221',
    description: 'Target workout UUID',
  })
  workoutId: string;

  @ApiProperty({
    example: '2026-09-24T21:30:00.000Z',
    description: 'Session date/time in ISO 8601 UTC format',
  })
  date: string;

  @ApiProperty({
    enum: WorkoutSessionStatus,
    example: WorkoutSessionStatus.IN_PROGRESS,
    description: 'Current status of the workout session',
  })
  status: WorkoutSessionStatus;

  @ApiPropertyOptional({
    example: 2850,
    description: 'Actual elapsed duration in seconds',
    nullable: true,
  })
  durationActualSeconds: number | null;

  @ApiPropertyOptional({
    example: 410,
    description: 'Active kcal burned',
    nullable: true,
  })
  kcalBurned: number | null;

  @ApiPropertyOptional({
    example: 138,
    description: 'Average heart rate in bpm',
    nullable: true,
  })
  avgHeartRate: number | null;

  @ApiPropertyOptional({
    type: () => WorkoutResponseDto,
    description: 'Associated workout details if loaded',
    nullable: true,
  })
  workout?: WorkoutResponseDto;

  static fromEntity(
    session: WorkoutSession & { workout?: Workout | null },
  ): WorkoutSessionResponseDto {
    return {
      id: session.id,
      userId: session.userId,
      workoutId: session.workoutId,
      date: session.date.toISOString(),
      status: session.status,
      durationActualSeconds: session.durationActualSeconds,
      kcalBurned: session.kcalBurned,
      avgHeartRate: session.avgHeartRate,
      workout: session.workout
        ? WorkoutResponseDto.fromEntity(session.workout)
        : undefined,
    };
  }
}
