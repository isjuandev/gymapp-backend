import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanService } from '../plan/plan.service';
import { GoalType, PlanType, ScheduleOrigin } from '@prisma/client';
import {
  PlanConsistencyViolationDto,
  IntegritySeverity,
} from './dto/integrity-response.dto';

/**
 * Integrity verifier for Fase 2 plan consistency (invariants 1-5).
 * Read-only `checkAll()` plus targeted repairs executed through PlanService
 * (the single writer), so verification and repair can run after every deploy.
 *
 * Auto-fixable violations are repaired WITHOUT deleting history: library
 * workouts, sessions, set logs, weight entries and goal rows are never
 * removed (invariant 7); only the canonical plan row, goal pointer and the
 * derived schedule are rewritten.
 */
@Injectable()
export class IntegrityService {
  private readonly logger = new Logger(IntegrityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planService: PlanService,
  ) {}

  async checkAll(limit = 500): Promise<PlanConsistencyViolationDto[]> {
    const users = await this.prisma.user.findMany({
      take: limit,
      select: { id: true },
      orderBy: { joinDate: 'asc' },
    });
    const violations: PlanConsistencyViolationDto[] = [];
    for (const { id } of users) {
      violations.push(...(await this.checkUser(id)));
    }
    return violations;
  }

  async checkUser(userId: string): Promise<PlanConsistencyViolationDto[]> {
    const violations: PlanConsistencyViolationDto[] = [];
    const push = (
      code: string,
      severity: IntegritySeverity,
      message: string,
      autoFixable: boolean,
    ) => violations.push({ userId, code, severity, message, autoFixable });

    const [userPlan, profile, user] = await Promise.all([
      this.prisma.userPlan.findUnique({
        where: { userId },
        include: { program: { include: { workouts: true } } },
      }),
      this.prisma.onboardingProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!user) return violations;
    const onboardingComplete = Boolean(profile?.completedAt);

    // Invariant 1/4: complete onboarding must yield exactly one active plan.
    if (onboardingComplete && !userPlan) {
      push(
        'NO_USER_PLAN_WITH_COMPLETE_ONBOARDING',
        'high',
        'Onboarding is complete but the user has no canonical UserPlan row: screens fall back to divergent sources',
        true,
      );
      return violations;
    }
    if (!userPlan) return violations; // state 'none' is valid (invariant 1)

    // Invariant 4: preset plans always reference a program.
    if (userPlan.planType === PlanType.PRESET && !userPlan.programId) {
      push(
        'PRESET_PLAN_WITHOUT_PROGRAM',
        'high',
        'PRESET UserPlan has no programId: nothing to derive the schedule from',
        true,
      );
    }
    if (
      userPlan.planType === PlanType.PRESET &&
      userPlan.program &&
      userPlan.program.workouts.length === 0
    ) {
      push(
        'PRESET_PROGRAM_WITHOUT_WORKOUTS',
        'high',
        `Program '${userPlan.program.title}' has no workouts: generation cannot produce training days`,
        false,
      );
    }

    const schedule = await this.prisma.customRoutineDayAssignment.findMany({
      where: { userId },
    });
    const configuredDays = schedule.filter((r) => r.workoutId || r.isRestDay);

    // Invariant 2/3: active plan implies a configured schedule.
    if (configuredDays.length === 0) {
      push(
        userPlan.planType === PlanType.PRESET
          ? 'PRESET_PLAN_WITH_EMPTY_SCHEDULE'
          : 'CUSTOM_PLAN_WITH_EMPTY_SCHEDULE',
        userPlan.planType === PlanType.PRESET ? 'medium' : 'low',
        'Active plan has a fully unassigned schedule: Home shows nothing trainable and Horario shows "Sin asignar" everywhere',
        userPlan.planType === PlanType.PRESET,
      );
    }

    // Single-writer audit: MANUAL rows may only exist under CUSTOM plans.
    // (They appear under PRESET only if a third writer bypassed PlanService.)
    if (
      userPlan.planType === PlanType.PRESET &&
      schedule.some((r) => r.origin === ScheduleOrigin.MANUAL)
    ) {
      push(
        'SCHEDULE_MANUAL_ROWS_UNDER_PRESET',
        'medium',
        'Schedule contains MANUAL rows under a PRESET plan: a writer bypassed PlanService.assignPlan',
        true,
      );
    }

    // Invariant 5: goal pointer follows the active plan.
    const expectedGoal = this.expectedGoalForPlan(
      userPlan.planType,
      userPlan.program?.category ?? null,
      profile?.goal ?? null,
      user.goalType,
    );
    if (expectedGoal && user.goalType !== expectedGoal) {
      push(
        'GOAL_TYPE_MISMATCH',
        'medium',
        `User.goalType is '${user.goalType}' but the active plan serves '${expectedGoal}': nutrition targets follow the wrong goal`,
        true,
      );
    }
    if (expectedGoal) {
      const goalRow = await this.prisma.goal.findFirst({
        where: { userId, type: expectedGoal },
      });
      if (!goalRow) {
        push(
          'MISSING_GOAL_ROW_FOR_PLAN',
          'low',
          `No Goal row of type '${expectedGoal}' for the active plan`,
          true,
        );
      }
    }

    return violations;
  }

  /**
   * Repairs every auto-fixable violation. Idempotent: repairing an already
   * consistent user is a no-op (checks run first, actions only on violations).
   * Returns per-user action results; failures never abort the batch.
   */
  async repairAll(
    limit = 500,
    dryRun = true,
  ): Promise<
    { userId: string; action: string; ok: boolean; error?: string }[]
  > {
    const actions: {
      userId: string;
      action: string;
      ok: boolean;
      error?: string;
    }[] = [];
    const violations = await this.checkAll(limit);
    const byUser = new Map<string, PlanConsistencyViolationDto[]>();
    for (const v of violations) {
      const list = byUser.get(v.userId) ?? [];
      list.push(v);
      byUser.set(v.userId, list);
    }

    for (const [userId, list] of byUser) {
      const fixable = list.filter((v) => v.autoFixable);
      if (fixable.length === 0) continue;
      const codes = fixable.map((v) => v.code);

      const needsAssign =
        codes.includes('NO_USER_PLAN_WITH_COMPLETE_ONBOARDING') ||
        codes.includes('PRESET_PLAN_WITHOUT_PROGRAM');
      const needsScheduleRepair =
        codes.includes('PRESET_PLAN_WITH_EMPTY_SCHEDULE') ||
        codes.includes('SCHEDULE_MANUAL_ROWS_UNDER_PRESET');
      const needsGoalAlign =
        codes.includes('GOAL_TYPE_MISMATCH') ||
        codes.includes('MISSING_GOAL_ROW_FOR_PLAN');

      if (dryRun) {
        if (needsAssign)
          actions.push({ userId, action: 'assignPlan', ok: true });
        if (needsScheduleRepair)
          actions.push({ userId, action: 'repairScheduleFromWeek', ok: true });
        if (needsGoalAlign && !needsAssign)
          actions.push({ userId, action: 'alignGoal', ok: true });
        continue;
      }

      try {
        if (needsAssign) {
          const plan = await this.prisma.userPlan.findUnique({
            where: { userId },
          });
          await this.planService.assignPlan(
            userId,
            plan?.programId ?? undefined,
          );
          actions.push({ userId, action: 'assignPlan', ok: true });
        } else {
          if (needsScheduleRepair) {
            await this.planService.repairScheduleFromWeek(userId);
            actions.push({
              userId,
              action: 'repairScheduleFromWeek',
              ok: true,
            });
          }
          if (needsGoalAlign) {
            const goal = await this.resolveExpectedGoal(userId);
            if (goal) {
              await this.planService.alignGoal(userId, goal);
              actions.push({ userId, action: 'alignGoal', ok: true });
            }
          }
        }
      } catch (err) {
        this.logger.warn(
          `Repair failed for user '${userId}': ${(err as Error)?.message || err}`,
        );
        actions.push({
          userId,
          action: needsAssign ? 'assignPlan' : 'repair',
          ok: false,
          error: (err as Error)?.message || String(err),
        });
      }
    }
    return actions;
  }

  private expectedGoalForPlan(
    planType: PlanType,
    programCategory: { toString(): string } | null,
    profileGoal: GoalType | null,
    userGoal: GoalType | null,
  ): GoalType | null {
    if (planType === PlanType.PRESET && programCategory) {
      switch (String(programCategory)) {
        case 'WEIGHT_LOSS':
          return GoalType.LOSE_WEIGHT;
        case 'MUSCLE_GAIN':
          return GoalType.GAIN_MUSCLE;
        case 'HEALTH':
          return GoalType.IMPROVE_HEALTH;
        default:
          return null;
      }
    }
    return profileGoal ?? userGoal ?? null;
  }

  private async resolveExpectedGoal(userId: string): Promise<GoalType | null> {
    const [plan, profile, user] = await Promise.all([
      this.prisma.userPlan.findUnique({
        where: { userId },
        include: { program: true },
      }),
      this.prisma.onboardingProfile.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!plan) return null;
    return this.expectedGoalForPlan(
      plan.planType,
      plan.program?.category ?? null,
      profile?.goal ?? null,
      user?.goalType ?? null,
    );
  }
}
