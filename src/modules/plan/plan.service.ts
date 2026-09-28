import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanRepository } from './repositories/plan.repository';
import { WorkoutsRepository } from '../workouts/repositories/workouts.repository';
import { WorkoutsService } from '../workouts/workouts.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import {
  getMondayOfWeek,
  parseWeekStartDate,
  resolveDayInTimezone,
  DAYS_OF_WEEK_ORDER,
} from './utils/date.utils';
import { UpdatePlanDayDto } from './dto/update-plan-day.dto';
import { WeeklyPlanResponseDto } from './dto/weekly-plan-response.dto';
import { PlanDayResponseDto } from './dto/plan-day-response.dto';
import {
  PlanStateResponseDto,
  PlanStateDayDto,
  PlanTodayStatus,
} from './dto/plan-state-response.dto';
import { UpdateCustomScheduleDto } from '../custom-schedule/dto/update-custom-schedule.dto';
import { CustomScheduleDayDto } from '../custom-schedule/dto/custom-schedule-response.dto';
import {
  DayOfWeek,
  ExperienceLevel,
  GoalType,
  PlanType,
  Prisma,
  ProgramCategory,
  ScheduleOrigin,
} from '@prisma/client';

/** Program category -> goal served (inverse of GOAL_TO_CATEGORY). */
const CATEGORY_TO_GOAL: Record<ProgramCategory, GoalType> = {
  [ProgramCategory.WEIGHT_LOSS]: GoalType.LOSE_WEIGHT,
  [ProgramCategory.MUSCLE_GAIN]: GoalType.GAIN_MUSCLE,
  [ProgramCategory.HEALTH]: GoalType.IMPROVE_HEALTH,
};

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planRepository: PlanRepository,
    private readonly workoutsRepository: WorkoutsRepository,
    private readonly workoutsService: WorkoutsService,
    private readonly recommendationService: RecommendationService,
  ) {}

  /**
   * GET /plan/current: Retrieves or automatically generates the current week's WeeklyPlan.
   */
  async getCurrentPlan(userId: string): Promise<WeeklyPlanResponseDto> {
    const monday = getMondayOfWeek(new Date());
    return this.getOrCreateWeeklyPlan(userId, monday);
  }

  /**
   * GET /plan?weekStartDate=YYYY-MM-DD: Retrieves or generates the WeeklyPlan for a specified week.
   */
  async getPlanByWeek(
    userId: string,
    weekStartDateInput?: string,
  ): Promise<WeeklyPlanResponseDto> {
    const monday = parseWeekStartDate(weekStartDateInput);
    return this.getOrCreateWeeklyPlan(userId, monday);
  }

  /**
   * PATCH /plan/days/:planDayId: status-only edits (e.g. marking completed).
   *
   * Fase 2 single-writer rule: workout/rest ASSIGNMENT changes are rejected
   * here (409). Preset assignments come from PlanService.assignPlan, custom
   * ones from PUT /custom-schedule/:dayOfWeek. This endpoint may only flip
   * `status`, which has no schedule counterpart.
   */
  async updatePlanDay(
    planDayId: string,
    userId: string,
    dto: UpdatePlanDayDto,
  ): Promise<PlanDayResponseDto> {
    const planDay = await this.planRepository.findPlanDayById(planDayId);
    if (!planDay) {
      throw new NotFoundException(`Plan day with ID '${planDayId}' not found`);
    }

    // Ownership check: ensure this planDay belongs to the authenticated user's weeklyPlan
    if (planDay.weeklyPlan.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this plan day',
      );
    }

    // Assignment changes (workoutId / isRestDay differing from stored values)
    // would fork PlanDay away from the single schedule: reject them.
    const wantsWorkoutChange =
      dto.workoutId !== undefined &&
      (dto.workoutId ?? null) !== (planDay.workoutId ?? null);
    const wantsRestChange =
      dto.isRestDay !== undefined && dto.isRestDay !== planDay.isRestDay;
    if (wantsWorkoutChange || wantsRestChange) {
      throw new ConflictException(
        'Plan day assignments are owned by the active plan: change the weekly schedule instead (PUT /custom-schedule/:dayOfWeek for custom plans, or assign another preset plan).',
      );
    }

    // If a new workoutId is provided (identical to stored), verify it exists
    if (dto.workoutId) {
      const workout = await this.workoutsRepository.findById(dto.workoutId);
      if (!workout) {
        throw new NotFoundException(
          `Workout with ID '${dto.workoutId}' not found`,
        );
      }
    }

    // If marked as rest day, clear workoutId unless an explicit workout was also provided
    const updateData: UpdatePlanDayDto = { ...dto };
    if (dto.isRestDay === true && dto.workoutId === undefined) {
      updateData.workoutId = null;
    } else if (dto.workoutId) {
      // If a workout is assigned, ensure isRestDay is false
      updateData.isRestDay = false;
    }

    const updated = await this.planRepository.updatePlanDay(
      planDayId,
      updateData,
    );
    return PlanDayResponseDto.fromEntity(updated);
  }

  /**
   * POST /plan/regenerate: Force recalculation of weekly plan for the given week.
   */
  async regenerateWeeklyPlan(
    userId: string,
    weekStartDateInput?: string,
  ): Promise<WeeklyPlanResponseDto> {
    const monday = parseWeekStartDate(weekStartDateInput);
    const generated = await this.recommendationService.generateWeeklyPlan(
      userId,
      monday,
    );
    return WeeklyPlanResponseDto.fromEntityWithDays(generated);
  }

  /**
   * Internal helper: Finds existing plan for the given Monday or provisions one
   * via RecommendationService based on the user's onboarding profile and equipment preferences.
   */
  private async getOrCreateWeeklyPlan(
    userId: string,
    monday: Date,
  ): Promise<WeeklyPlanResponseDto> {
    const existing = await this.planRepository.findWeeklyPlanByWeek(
      userId,
      monday,
    );
    if (existing) {
      // Check if existing plan was generated when the program only had 1 workout, but now has multiple workouts
      const activeDays = existing.days.filter(
        (d) => !d.isRestDay && d.workoutId,
      );
      const uniqueWorkoutIds = new Set(activeDays.map((d) => d.workoutId));
      if (activeDays.length > 1 && uniqueWorkoutIds.size === 1) {
        this.logger.log(
          `User ${userId} week ${monday.toISOString().slice(0, 10)} has repeating workout. Refreshing plan with updated program workouts.`,
        );
        const refreshed = await this.recommendationService.generateWeeklyPlan(
          userId,
          monday,
        );
        return WeeklyPlanResponseDto.fromEntityWithDays(refreshed);
      }
      return WeeklyPlanResponseDto.fromEntityWithDays(existing);
    }

    this.logger.log(
      `No WeeklyPlan found for user ${userId} on week ${monday.toISOString().slice(0, 10)}. Auto-generating via RecommendationService.`,
    );

    const generated = await this.recommendationService.generateWeeklyPlan(
      userId,
      monday,
    );

    return WeeklyPlanResponseDto.fromEntityWithDays(generated);
  }

  // ============================================================================
  // FASE 2 — CANONICAL PLAN (single writer / single reader)
  // ============================================================================

  /**
   * Assigns a PRESET plan (program template) to the user in ONE transaction:
   * canonical UserPlan row, User goal/program sync, Goal row alignment
   * (nutrition reads User.goalType, so this also aligns the nutritional
   * objective), WeeklyPlan regeneration and SINGLE schedule rewrite.
   * Called by onboarding (no programId: engine resolves by goal/level) and by
   * "change plan" (POST /programs/:id/enroll, POST /plan/assign).
   * Switching plans replaces the derived schedule but NEVER deletes the
   * workout library, sessions, weights or goals (invariant 7).
   *
   * TODO(nutrition): when preset meal plans exist as content, persist a
   * NutritionTarget row here instead of only aligning the goal.
   */
  async assignPlan(
    userId: string,
    programId?: string,
  ): Promise<{
    state: PlanStateResponseDto;
    weeklyPlan: WeeklyPlanResponseDto;
  }> {
    if (programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: programId },
      });
      if (!program) {
        throw new NotFoundException(`Program with ID '${programId}' not found`);
      }
    }

    const monday = getMondayOfWeek(new Date());
    const blueprint = await this.recommendationService.resolveBlueprint(
      userId,
      monday,
      programId,
    );
    const planGoal = CATEGORY_TO_GOAL[blueprint.chosenProgram.category];

    const weeklyPlan = await this.prisma.$transaction(async (tx) => {
      const persisted = await this.recommendationService.persistBlueprint(
        tx,
        userId,
        monday,
        blueprint,
        {
          userPlan: {
            planType: PlanType.PRESET,
            programId: blueprint.chosenProgram.id,
          },
          scheduleOrigin: ScheduleOrigin.PRESET_GENERATED,
          forceProgramSync: programId != null,
        },
      );

      // Align User goal pointer + Goal rows (nutrition reads User.goalType).
      await this.alignGoalTx(tx, userId, planGoal);

      return persisted;
    });

    const state = await this.getPlanState(userId);
    return {
      state,
      weeklyPlan: WeeklyPlanResponseDto.fromEntityWithDays(weeklyPlan),
    };
  }

  /**
   * Aligns the goal pointer and rows to the given goal in their own
   * transaction. Used by assignPlan (inside its larger tx via alignGoalTx)
   * and by the integrity repair flow.
   */
  async alignGoal(userId: string, planGoal: GoalType): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.alignGoalTx(tx, userId, planGoal);
    });
  }

  private async alignGoalTx(
    tx: Prisma.TransactionClient,
    userId: string,
    planGoal: GoalType,
  ): Promise<void> {
    // Align User goal pointer (nutrition + UI read this first).
    await tx.user.update({
      where: { id: userId },
      data: { goalType: planGoal },
    });

    // Align Goal rows: reuse the latest row of the plan's goal type so we
    // never proliferate rows on plan switches; create one only if missing.
    const existingGoal = await tx.goal.findFirst({
      where: { userId, type: planGoal },
      orderBy: { createdAt: 'desc' },
    });
    if (!existingGoal) {
      const latestWeight = await tx.weightEntry.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
      });
      const profile = await tx.onboardingProfile.findUnique({
        where: { userId },
      });
      const referenceWeight =
        latestWeight?.weightKg ??
        profile?.currentWeightKg ??
        (await tx.user.findUnique({ where: { id: userId } }))?.targetWeightKg ??
        0;
      await tx.goal.create({
        data: {
          userId,
          type: planGoal,
          targetValue: profile?.targetWeightKg ?? referenceWeight,
          currentValue: referenceWeight,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  /**
   * Manual edit path for CUSTOM plans (PUT /custom-schedule/:dayOfWeek).
   * Second and only other schedule writer: in ONE transaction ensures the user
   * has an active CUSTOM UserPlan (creates it, or converts a PRESET keeping
   * existing rows as the starting point) and upserts the day as MANUAL.
   * Library workouts and history are untouched.
   */
  async upsertCustomScheduleDay(
    userId: string,
    dayOfWeek: DayOfWeek,
    dto: UpdateCustomScheduleDto,
  ): Promise<CustomScheduleDayDto> {
    const isRest = dto.isRestDay === true;
    const hasWorkout = Boolean(
      dto.workoutId && dto.workoutId.trim().length > 0,
    );

    if ((isRest && hasWorkout) || (!isRest && !hasWorkout)) {
      throw new BadRequestException(
        'Validation failed: must provide either workoutId or isRestDay: true, but not both or neither',
      );
    }

    if (hasWorkout) {
      const workout = await this.prisma.workout.findUnique({
        where: { id: dto.workoutId! },
      });
      if (!workout) {
        throw new NotFoundException(
          `Workout with ID '${dto.workoutId}' not found`,
        );
      }
      if (workout.ownerUserId !== userId) {
        throw new BadRequestException(
          'Workout must belong to the authenticated user and cannot be a catalog workout',
        );
      }
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const activePlan = await tx.userPlan.findUnique({ where: { userId } });
      if (!activePlan) {
        const profile = await tx.onboardingProfile.findUnique({
          where: { userId },
        });
        const user = await tx.user.findUnique({ where: { id: userId } });
        await tx.userPlan.create({
          data: {
            userId,
            planType: PlanType.CUSTOM,
            programId: null,
            goal: profile?.goal ?? user?.goalType ?? GoalType.IMPROVE_HEALTH,
            startedAt: new Date(),
          },
        });
      } else if (activePlan.planType === PlanType.PRESET) {
        // Switching preset -> custom: keep current rows as the starting point.
        await tx.userPlan.update({
          where: { userId },
          data: {
            planType: PlanType.CUSTOM,
            programId: null,
            startedAt: new Date(),
          },
        });
      }

      return tx.customRoutineDayAssignment.upsert({
        where: { userId_dayOfWeek: { userId, dayOfWeek } },
        create: {
          userId,
          dayOfWeek,
          workoutId: isRest ? null : dto.workoutId,
          isRestDay: isRest,
          origin: ScheduleOrigin.MANUAL,
        },
        update: {
          workoutId: isRest ? null : dto.workoutId,
          isRestDay: isRest,
          origin: ScheduleOrigin.MANUAL,
        },
        include: {
          workout: { include: { exercises: true } },
        },
      });
    });

    return this.toCustomScheduleDayDto(assignment);
  }

  /**
   * Reads the materialized 7-day schedule (shared by /plan/state,
   * /custom-schedule and the integrity checker). Never writes.
   */
  async readSchedule(userId: string): Promise<CustomScheduleDayDto[]> {
    const existing = await this.prisma.customRoutineDayAssignment.findMany({
      where: { userId },
      include: { workout: { include: { exercises: true } } },
    });
    const byDay = new Map(existing.map((a) => [a.dayOfWeek, a]));
    return DAYS_OF_WEEK_ORDER.map((day) => {
      const assignment = byDay.get(day);
      if (assignment) return this.toCustomScheduleDayDto(assignment);
      return {
        id: null,
        userId,
        dayOfWeek: day,
        workoutId: null,
        isRestDay: false,
        workout: null,
      };
    });
  }

  /**
   * GET /plan/state: the SINGLE read model for plan/week/today (invariant 4).
   * Read-only: never generates or mutates anything. No active UserPlan ->
   * `{ state: 'none' }` with HTTP 200 (never 404, so clients don't confuse it
   * with a network error). Today is derived ONLY from the materialized
   * schedule; a COMPLETED session today rotates the card to tomorrow.
   */
  async getPlanState(
    userId: string,
    timezoneHeader?: string,
  ): Promise<PlanStateResponseDto> {
    const todayBase = resolveDayInTimezone(timezoneHeader);
    const emptyToday = (
      status: PlanTodayStatus,
      targetDay: 'today' | 'tomorrow' = 'today',
    ): PlanStateResponseDto['today'] => ({
      date: todayBase.dateString,
      dayOfWeek: todayBase.dayOfWeek,
      status,
      targetDay,
      isTodayCompleted: false,
      workout: null,
      origin: null,
    });

    const userPlan = await this.prisma.userPlan.findUnique({
      where: { userId },
      include: { program: true },
    });
    if (!userPlan) {
      return {
        state: 'none',
        plan: null,
        schedule: [],
        today: emptyToday('none'),
      };
    }

    // Materialized schedule -> state days (personalized workout detail).
    const rows = await this.prisma.customRoutineDayAssignment.findMany({
      where: { userId },
    });
    const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));

    const schedule: PlanStateDayDto[] = [];
    for (const day of DAYS_OF_WEEK_ORDER) {
      const row = byDay.get(day);
      if (!row || (!row.workoutId && !row.isRestDay)) {
        schedule.push({
          dayOfWeek: day,
          status: 'unassigned',
          origin: row?.origin ?? null,
          workout: null,
        });
        continue;
      }
      if (row.isRestDay || !row.workoutId) {
        schedule.push({
          dayOfWeek: day,
          status: 'rest',
          origin: row.origin,
          workout: null,
        });
        continue;
      }
      try {
        const workout = await this.workoutsService.getWorkoutById(
          row.workoutId,
          userId,
        );
        schedule.push({
          dayOfWeek: day,
          status: 'workout',
          origin: row.origin,
          workout,
        });
      } catch (err) {
        this.logger.warn(
          `Schedule workout '${row.workoutId}' for user '${userId}' could not be resolved: ${(err as Error)?.message || err}`,
        );
        schedule.push({
          dayOfWeek: day,
          status: 'unassigned',
          origin: row.origin,
          workout: null,
        });
      }
    }

    // Rotation: a COMPLETED session today moves the card to tomorrow.
    const recentCompleted = await this.prisma.workoutSession.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { date: 'desc' },
      take: 10,
    });
    const isTodayCompleted = recentCompleted.some(
      (s) =>
        resolveDayInTimezone(timezoneHeader, new Date(s.date)).dateString ===
        todayBase.dateString,
    );

    const targetInfo = isTodayCompleted
      ? resolveDayInTimezone(
          timezoneHeader,
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        )
      : todayBase;
    const targetDay = schedule.find(
      (d) => d.dayOfWeek === targetInfo.dayOfWeek,
    );

    // Plan metadata.
    let weekNumber: number | null = null;
    let totalWeeks: number | null = null;
    let experienceLevel: ExperienceLevel | null = null;
    if (userPlan.planType === PlanType.PRESET) {
      totalWeeks = userPlan.program?.durationWeeks ?? 12;
      const elapsedWeeks = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(userPlan.startedAt).getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        ),
      );
      weekNumber = Math.max(1, Math.min(totalWeeks, elapsedWeeks + 1));
      const profile = await this.prisma.onboardingProfile.findUnique({
        where: { userId },
      });
      experienceLevel = profile?.experienceLevel ?? null;
    }

    return {
      state: 'active',
      plan: {
        type: userPlan.planType === PlanType.PRESET ? 'preset' : 'custom',
        programId: userPlan.programId ?? null,
        programTitle: userPlan.program?.title ?? null,
        goal: userPlan.goal,
        experienceLevel,
        weekNumber,
        totalWeeks,
        startedAt: new Date(userPlan.startedAt).toISOString(),
      },
      schedule,
      today: {
        date: targetInfo.dateString,
        dayOfWeek: targetInfo.dayOfWeek,
        status: targetDay?.status ?? 'unassigned',
        targetDay: isTodayCompleted ? 'tomorrow' : 'today',
        isTodayCompleted,
        workout: targetDay?.workout ?? null,
        origin: targetDay?.origin ?? null,
        timezone: targetInfo.effectiveTimezone,
      },
    };
  }

  /**
   * Repairs a PRESET schedule from the current WeeklyPlan without regenerating
   * (preserves PlanDay statuses). Used by the integrity repair flow.
   */
  async repairScheduleFromWeek(userId: string): Promise<void> {
    const monday = getMondayOfWeek(new Date());
    const week = await this.planRepository.findWeeklyPlanByWeek(userId, monday);
    if (!week) {
      throw new NotFoundException(
        `No weekly plan found for the current week to repair the schedule from`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customRoutineDayAssignment.deleteMany({ where: { userId } });
      await tx.customRoutineDayAssignment.createMany({
        data: [...week.days]
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          )
          .map((day, dayIndex) => ({
            userId,
            dayOfWeek: DAYS_OF_WEEK_ORDER[dayIndex % 7],
            workoutId: day.workoutId,
            isRestDay: day.isRestDay,
            origin: ScheduleOrigin.PRESET_GENERATED,
          })),
      });
    });
  }

  private toCustomScheduleDayDto(assignment: {
    id: string;
    userId: string;
    dayOfWeek: DayOfWeek;
    workoutId: string | null;
    isRestDay: boolean;
    origin?: ScheduleOrigin;
    workout?: {
      id: string;
      title: string;
      durationMinutes: number | null;
      kcalEstimate: number | null;
      imageAssetName: string | null;
      exercises?: unknown[];
    } | null;
  }): CustomScheduleDayDto {
    return {
      id: assignment.id,
      userId: assignment.userId,
      dayOfWeek: assignment.dayOfWeek,
      workoutId: assignment.workoutId,
      isRestDay: assignment.isRestDay,
      workout: assignment.workout
        ? {
            id: assignment.workout.id,
            title: assignment.workout.title,
            durationMinutes: assignment.workout.durationMinutes,
            kcalEstimate: assignment.workout.kcalEstimate,
            imageAssetName: assignment.workout.imageAssetName,
            exercisesCount: assignment.workout.exercises?.length ?? 0,
          }
        : null,
    };
  }
}
