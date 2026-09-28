import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DayOfWeek,
  ExperienceLevel,
  GoalType,
  ScheduleOrigin,
} from '@prisma/client';
import { WorkoutDetailResponseDto } from '../../workouts/dto/workout-detail-response.dto';

/**
 * Canonical plan state (Fase 2 consistency, invariant 4).
 * Single read model consumed by ALL screens (Home, Mi Plan, Mis Rutinas >
 * Horario, tab Plan). `state: 'none'` (HTTP 200, never 404) means the user
 * has no active plan: schedule is empty and there is no today workout.
 */
export type PlanStateKind = 'active' | 'none';

export type PlanScheduleDayStatus = 'workout' | 'rest' | 'unassigned';

export type PlanTodayStatus = PlanScheduleDayStatus | 'none';

export class PlanStatePlanDto {
  @ApiProperty({
    enum: ['preset', 'custom'],
    example: 'preset',
    description:
      'Active plan kind: preset (generated from a Program template) or custom (hand-assembled schedule)',
  })
  type: 'preset' | 'custom';

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Program UUID for preset plans, null for custom plans',
    nullable: true,
  })
  programId?: string | null;

  @ApiPropertyOptional({
    example: 'Hipertrofia Total',
    description: 'Program title for preset plans, null for custom plans',
    nullable: true,
  })
  programTitle?: string | null;

  @ApiProperty({
    enum: GoalType,
    example: GoalType.LOSE_WEIGHT,
    description: 'Goal this plan serves (aligned with Goal rows and nutrition)',
  })
  goal: GoalType;

  @ApiPropertyOptional({
    example: 1,
    description: 'Current week number for preset plans, null for custom plans',
    nullable: true,
  })
  weekNumber?: number | null;

  @ApiPropertyOptional({
    example: 12,
    description: 'Total weeks for preset plans, null for custom plans',
    nullable: true,
  })
  totalWeeks?: number | null;

  @ApiProperty({
    example: '2026-09-28T00:00:00.000Z',
    description: 'When this plan became active (ISO 8601)',
  })
  startedAt: string;

  @ApiPropertyOptional({
    enum: ExperienceLevel,
    example: ExperienceLevel.INTERMEDIATE,
    description: 'Training level this plan was built for (from onboarding)',
    nullable: true,
  })
  experienceLevel?: ExperienceLevel | null;
}

export class PlanStateDayDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  dayOfWeek: DayOfWeek;

  @ApiProperty({
    enum: ['workout', 'rest', 'unassigned'],
    example: 'workout',
    description:
      'workout = scheduled training, rest = configured rest day, unassigned = no row / empty (only possible on fresh custom plans)',
  })
  status: PlanScheduleDayStatus;

  @ApiPropertyOptional({
    enum: ScheduleOrigin,
    example: ScheduleOrigin.PRESET_GENERATED,
    description: 'Which writer produced this row (single-writer audit)',
    nullable: true,
  })
  origin?: ScheduleOrigin | null;

  @ApiPropertyOptional({
    type: () => WorkoutDetailResponseDto,
    description: 'Full workout detail when status is workout',
    nullable: true,
  })
  workout?: WorkoutDetailResponseDto | null;
}

export class PlanStateTodayDto {
  @ApiProperty({ example: '2026-09-28' })
  date: string;

  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  dayOfWeek: DayOfWeek;

  @ApiProperty({
    enum: ['workout', 'rest', 'unassigned', 'none'],
    example: 'workout',
    description:
      'none = no active plan. unassigned = active plan but nothing scheduled today.',
  })
  status: PlanTodayStatus;

  @ApiProperty({
    enum: ['today', 'tomorrow'],
    example: 'today',
    description: 'If today is already completed, the card rotates to tomorrow.',
  })
  targetDay: 'today' | 'tomorrow';

  @ApiProperty({ example: false })
  isTodayCompleted: boolean;

  @ApiPropertyOptional({
    type: () => WorkoutDetailResponseDto,
    nullable: true,
  })
  workout?: WorkoutDetailResponseDto | null;

  @ApiPropertyOptional({
    enum: ScheduleOrigin,
    nullable: true,
  })
  origin?: ScheduleOrigin | null;

  @ApiPropertyOptional({
    example: 'America/Bogota',
    description: 'Effective timezone used to resolve today (defaults to UTC)',
    nullable: true,
  })
  timezone?: string | null;
}

export class PlanStateResponseDto {
  @ApiProperty({
    enum: ['active', 'none'],
    example: 'active',
    description:
      'none = user has no active plan: schedule is empty and there is no today workout. Clients show the pick-a-plan CTA. Always HTTP 200, never 404.',
  })
  state: PlanStateKind;

  @ApiPropertyOptional({
    type: () => PlanStatePlanDto,
    description: 'Active plan metadata, null when state is none',
    nullable: true,
  })
  plan: PlanStatePlanDto | null;

  @ApiProperty({
    type: () => [PlanStateDayDto],
    description: 'Materialized weekly schedule, Monday through Sunday',
  })
  schedule: PlanStateDayDto[];

  @ApiProperty({ type: () => PlanStateTodayDto })
  today: PlanStateTodayDto;
}
