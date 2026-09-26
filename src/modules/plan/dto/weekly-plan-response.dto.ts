import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanDay, Program, WeeklyPlan, Workout } from '@prisma/client';
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
    example: 1,
    description: 'Current week number relative to program start',
  })
  currentWeekNumber: number;

  @ApiProperty({
    example: 12,
    description: 'Total number of weeks in the program',
  })
  totalWeeks: number;

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Associated Program UUID',
    nullable: true,
  })
  programId?: string | null;

  @ApiPropertyOptional({
    example: 'Hipertrofia Total',
    description: 'Associated Program title',
    nullable: true,
  })
  programTitle?: string | null;

  @ApiProperty({
    type: () => [PlanDayResponseDto],
    description:
      '7 days of the week (Monday through Sunday) with assigned workouts',
  })
  days: PlanDayResponseDto[];

  static fromEntityWithDays(
    plan: WeeklyPlan & {
      days: (PlanDay & { workout?: Workout | null })[];
      program?: Program | null;
    },
  ): WeeklyPlanResponseDto {
    return {
      id: plan.id,
      userId: plan.userId,
      weekStartDate: plan.weekStartDate.toISOString(),
      currentWeekNumber: plan.weekNumber ?? 1,
      totalWeeks: plan.totalWeeks ?? 12,
      programId: plan.programId ?? null,
      programTitle: plan.program?.title ?? null,
      days: (plan.days || [])
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((d) => PlanDayResponseDto.fromEntity(d)),
    };
  }
}
