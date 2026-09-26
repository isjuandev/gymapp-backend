import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { PlanService } from '../plan/plan.service';
import { DayOfWeek } from '@prisma/client';
import {
  TodayWorkoutResponseDto,
  TodayWorkoutSource,
} from './dto/today-workout-response.dto';
import { DAYS_OF_WEEK_ORDER } from '../custom-schedule/custom-schedule.service';

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
   * Priority:
   * 1. CustomRoutineDayAssignment for today's dayOfWeek
   *    - If workoutId is assigned -> source: 'custom', full resolved workout
   *    - If isRestDay is true -> source: 'restDay'
   * 2. Recommended weekly plan (GET /plan/current engine)
   *    - If today's PlanDay has workoutId -> source: 'recommended', full resolved workout
   *    - If today's PlanDay isRestDay -> source: 'restDay'
   * 3. None: new user without onboarding or schedule -> source: 'none'
   *
   * @param userId Authenticated user UUID
   * @param timezoneHeader Optional IANA timezone identifier from X-Timezone header (defaults to UTC)
   */
  async getTodayWorkout(
    userId: string,
    timezoneHeader?: string,
  ): Promise<TodayWorkoutResponseDto> {
    const { dayOfWeek, dateString, effectiveTimezone } =
      this.resolveDayInTimezone(timezoneHeader);

    // 1. Check CustomRoutineDayAssignment for this user & dayOfWeek
    const assignment =
      await this.prisma.customRoutineDayAssignment.findUnique({
        where: {
          userId_dayOfWeek: {
            userId,
            dayOfWeek,
          },
        },
      });

    if (assignment) {
      if (assignment.workoutId) {
        try {
          const workout = await this.workoutsService.getWorkoutById(
            assignment.workoutId,
            userId,
          );
          return {
            source: 'custom',
            workout,
            dayOfWeek,
            timezone: effectiveTimezone,
          };
        } catch (err: any) {
          this.logger.warn(
            `Custom workout '${assignment.workoutId}' assigned to ${dayOfWeek} for user '${userId}' could not be resolved: ${err?.message || err}. Falling back to recommendation.`,
          );
        }
      } else if (assignment.isRestDay) {
        return {
          source: 'restDay',
          dayOfWeek,
          timezone: effectiveTimezone,
        };
      }
    }

    // 2. Fall back to current weekly plan (recommendation engine)
    try {
      const weeklyPlan = await this.planService.getPlanByWeek(
        userId,
        dateString,
      );

      if (weeklyPlan && Array.isArray(weeklyPlan.days)) {
        const todayPlanDay =
          weeklyPlan.days.find((d) => d.date.startsWith(dateString)) ||
          weeklyPlan.days[DAYS_OF_WEEK_ORDER.indexOf(dayOfWeek)];

        if (todayPlanDay) {
          if (todayPlanDay.isRestDay || !todayPlanDay.workoutId) {
            return {
              source: 'restDay',
              dayOfWeek,
              timezone: effectiveTimezone,
            };
          }

          try {
            const workout = await this.workoutsService.getWorkoutById(
              todayPlanDay.workoutId,
              userId,
            );
            return {
              source: 'recommended',
              workout,
              dayOfWeek,
              timezone: effectiveTimezone,
            };
          } catch (err: any) {
            this.logger.warn(
              `Recommended workout '${todayPlanDay.workoutId}' for user '${userId}' could not be resolved: ${err?.message || err}`,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.debug(
        `User '${userId}' has no active weekly plan or incomplete onboarding: ${err?.message || err}`,
      );
    }

    // 3. Fallback: new user without onboarding or schedule
    return {
      source: 'none',
      dayOfWeek,
      timezone: effectiveTimezone,
    };
  }

  /**
   * Calculates the current dayOfWeek and YYYY-MM-DD date in the user's timezone.
   * Defaults to 'UTC' if timeZoneInput is missing or not a valid IANA timezone identifier.
   */
  resolveDayInTimezone(timeZoneInput?: string): TimezoneDayInfo {
    let effectiveTimezone = 'UTC';

    if (timeZoneInput && timeZoneInput.trim().length > 0) {
      const candidate = timeZoneInput.trim();
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: candidate });
        effectiveTimezone = candidate;
      } catch {
        effectiveTimezone = 'UTC';
      }
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(new Date());
    const weekdayStr = parts
      .find((p) => p.type === 'weekday')
      ?.value?.toUpperCase();
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    const dayOfWeek = (weekdayStr as DayOfWeek) || DayOfWeek.MONDAY;
    const dateString = `${year}-${month}-${day}`;

    return {
      dayOfWeek,
      dateString,
      effectiveTimezone,
    };
  }
}
