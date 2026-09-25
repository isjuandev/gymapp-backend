import { ApiProperty } from '@nestjs/swagger';
import { PlanDay, WeeklyPlan, Workout } from '@prisma/client';
import { PlanDayResponseDto } from './plan-day-response.dto';

export class WeeklyPlanResponseDto {
  @ApiProperty({
    example: '66666666-6666-4666-8666-666666666661',
    description: 'Unique WeeklyPlan UUID',
  })
  id: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'User UUID owner of this plan',
  })
  userId: string;

  @ApiProperty({
    example: '2026-09-21T00:00:00.000Z',
    description: 'Monday starting the week in ISO 8601 UTC format',
  })
  weekStartDate: string;

  @ApiProperty({
    type: () => [PlanDayResponseDto],
    description:
      '7 days of the week (Monday through Sunday) with assigned workouts',
  })
  days: PlanDayResponseDto[];

  static fromEntityWithDays(
    plan: WeeklyPlan & {
      days: (PlanDay & { workout?: Workout | null })[];
    },
  ): WeeklyPlanResponseDto {
    return {
      id: plan.id,
      userId: plan.userId,
      weekStartDate: plan.weekStartDate.toISOString(),
      days: (plan.days || [])
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((d) => PlanDayResponseDto.fromEntity(d)),
    };
  }
}
