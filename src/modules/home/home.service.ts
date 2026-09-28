import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { PlanService } from '../plan/plan.service';
import { DayOfWeek, ScheduleOrigin } from '@prisma/client';
import {
  TodayWorkoutResponseDto,
  TodayWorkoutSource,
} from './dto/today-workout-response.dto';
import { resolveDayInTimezone } from '../plan/utils/date.utils';

export interface TimezoneDayInfo {
  dayOfWeek: DayOfWeek;
  dateString: string;
  effectiveTimezone: string;
}

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workoutsService: WorkoutsService,
    private readonly planService: PlanService,
  ) {}

  /**
   * Resolves the primary workout card for the user's Home screen today.
   *
   * Fase 2 consistency: thin projection over PlanService.getPlanState, the
   * SINGLE plan/week/today read model. No parallel resolution, no divergent
   * fallback: source mapping is origin-based (MANUAL schedule row -> 'custom',
   * PRESET_GENERATED -> 'recommended').
   *
   * @param userId Authenticated user UUID
   * @param timezoneHeader Optional IANA timezone identifier from X-Timezone header (defaults to UTC)
   */
  async getTodayWorkout(
    userId: string,
    timezoneHeader?: string,
  ): Promise<TodayWorkoutResponseDto> {
    const state = await this.planService.getPlanState(userId, timezoneHeader);

    const source: TodayWorkoutSource =
      state.today.status === 'workout'
        ? state.today.origin === ScheduleOrigin.MANUAL
          ? 'custom'
          : 'recommended'
        : state.today.status === 'rest'
          ? 'restDay'
          : 'none';

    return {
      source,
      workout:
        state.today.status === 'workout'
          ? (state.today.workout ?? undefined)
          : undefined,
      dayOfWeek: state.today.dayOfWeek,
      timezone: state.today.timezone ?? undefined,
      targetDay: state.today.targetDay,
      isTodayCompleted: state.today.isTodayCompleted,
    };
  }

  /**
   * Calculates the dayOfWeek and YYYY-MM-DD date in the user's timezone for a given baseDate.
   * Defaults to 'UTC' if timeZoneInput is missing or not a valid IANA timezone identifier.
   * Kept for backward compatibility; delegates to the shared plan util.
   */
  resolveDayInTimezone(
    timeZoneInput?: string,
    baseDate: Date = new Date(),
  ): TimezoneDayInfo {
    return resolveDayInTimezone(timeZoneInput, baseDate);
  }
}
