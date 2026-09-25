import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanDay, PlanDayStatus, Workout } from '@prisma/client';
import { WorkoutResponseDto } from '../../workouts/dto/workout-response.dto';

export class PlanDayResponseDto {
  @ApiProperty({
    example: '55555555-5555-4555-8555-555555555551',
    description: 'Unique plan day UUID',
  })
  id: string;

  @ApiProperty({
    example: '66666666-6666-4666-8666-666666666661',
    description: 'Associated WeeklyPlan UUID',
  })
  weeklyPlanId: string;

  @ApiProperty({
    example: '2026-09-21T00:00:00.000Z',
    description: 'Date of this plan day in ISO 8601 UTC format',
  })
  date: string;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222221',
    description: 'Assigned workout UUID, or null if rest day',
    nullable: true,
  })
  workoutId: string | null;

  @ApiProperty({
    example: false,
    description: 'Whether this is a rest day',
  })
  isRestDay: boolean;

  @ApiProperty({
    enum: PlanDayStatus,
    example: PlanDayStatus.UPCOMING,
    description: 'Execution status of the day',
  })
  status: PlanDayStatus;

  @ApiPropertyOptional({
    type: () => WorkoutResponseDto,
    description: 'Workout details if assigned',
    nullable: true,
  })
  workout?: WorkoutResponseDto | null;

  static fromEntity(
    planDay: PlanDay & { workout?: Workout | null },
  ): PlanDayResponseDto {
    return {
      id: planDay.id,
      weeklyPlanId: planDay.weeklyPlanId,
      date: planDay.date.toISOString(),
      workoutId: planDay.workoutId,
      isRestDay: planDay.isRestDay,
      status: planDay.status,
      workout: planDay.workout
        ? WorkoutResponseDto.fromEntity(planDay.workout)
        : null,
    };
  }
}
