import { Test, TestingModule } from '@nestjs/testing';
import { IntegrityService } from './integrity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanService } from '../plan/plan.service';
import {
  GoalType,
  PlanType,
  ProgramCategory,
  ScheduleOrigin,
} from '@prisma/client';

/**
 * Integrity verifier (Fase 2): detects canonical-plan violations and
 * dry-run/apply repairs through PlanService without deleting history.
 */
describe('IntegrityService', () => {
  let service: IntegrityService;
  let prisma: any;
  let planService: any;

  const userId = 'user-integrity-1';

  const baseMocks = () => ({
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userPlan: { findUnique: jest.fn() },
    onboardingProfile: { findUnique: jest.fn() },
    customRoutineDayAssignment: { findMany: jest.fn() },
    goal: { findFirst: jest.fn() },
  });

  beforeEach(async () => {
    prisma = baseMocks();
    planService = {
      assignPlan: jest.fn(),
      alignGoal: jest.fn(),
      repairScheduleFromWeek: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrityService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlanService, useValue: planService },
      ],
    }).compile();

    service = module.get<IntegrityService>(IntegrityService);
  });

  const scanUser = (
    overrides: {
      plan?: any;
      profile?: any;
      user?: any;
      schedule?: any[];
      goalRow?: any;
    } = {},
  ) => {
    prisma.user.findMany.mockResolvedValue([{ id: userId }]);
    prisma.userPlan.findUnique.mockResolvedValue(overrides.plan ?? null);
    prisma.onboardingProfile.findUnique.mockResolvedValue(
      overrides.profile ?? null,
    );
    prisma.user.findUnique.mockResolvedValue(
      overrides.user ?? { id: userId, goalType: null },
    );
    prisma.customRoutineDayAssignment.findMany.mockResolvedValue(
      overrides.schedule ?? [],
    );
    prisma.goal.findFirst.mockResolvedValue(overrides.goalRow ?? null);
  };

  it('should flag complete onboarding without a canonical plan (invariant 1)', async () => {
    scanUser({ profile: { completedAt: new Date() } });

    const violations = await service.checkAll();

    expect(
      violations.some(
        (v) =>
          v.userId === userId &&
          v.code === 'NO_USER_PLAN_WITH_COMPLETE_ONBOARDING' &&
          v.severity === 'high' &&
          v.autoFixable,
      ),
    ).toBe(true);
  });

  it('should stay silent for users with no plan and no onboarding (valid none state)', async () => {
    scanUser();

    expect(await service.checkAll()).toEqual([]);
  });

  it('should flag MANUAL rows under a PRESET plan (third-writer evidence)', async () => {
    scanUser({
      profile: { completedAt: new Date(), goal: GoalType.GAIN_MUSCLE },
      user: { id: userId, goalType: GoalType.GAIN_MUSCLE },
      plan: {
        userId,
        planType: PlanType.PRESET,
        programId: 'prog-1',
        goal: GoalType.GAIN_MUSCLE,
        program: {
          id: 'prog-1',
          title: 'P',
          category: ProgramCategory.MUSCLE_GAIN,
          workouts: [{ id: 'w' }],
        },
      },
      schedule: [
        {
          userId,
          dayOfWeek: 'MONDAY',
          workoutId: 'w',
          isRestDay: false,
          origin: ScheduleOrigin.MANUAL,
        },
      ],
      goalRow: { id: 'g', type: GoalType.GAIN_MUSCLE },
    });

    const violations = await service.checkAll();

    expect(
      violations.some(
        (v) => v.code === 'SCHEDULE_MANUAL_ROWS_UNDER_PRESET' && v.autoFixable,
      ),
    ).toBe(true);
  });

  it('should flag goal pointer drift (invariant 5)', async () => {
    scanUser({
      profile: { completedAt: new Date(), goal: GoalType.LOSE_WEIGHT },
      user: { id: userId, goalType: GoalType.GAIN_MUSCLE },
      plan: {
        userId,
        planType: PlanType.PRESET,
        programId: 'prog-1',
        goal: GoalType.LOSE_WEIGHT,
        program: {
          id: 'prog-1',
          title: 'P',
          category: ProgramCategory.WEIGHT_LOSS,
          workouts: [{ id: 'w' }],
        },
      },
      schedule: [
        {
          userId,
          dayOfWeek: 'MONDAY',
          workoutId: 'w',
          isRestDay: false,
          origin: ScheduleOrigin.PRESET_GENERATED,
        },
      ],
      goalRow: { id: 'g', type: GoalType.LOSE_WEIGHT },
    });

    const violations = await service.checkAll();

    expect(
      violations.some((v) => v.code === 'GOAL_TYPE_MISMATCH' && v.autoFixable),
    ).toBe(true);
  });

  it('repair dry-run should list actions without calling PlanService', async () => {
    scanUser({ profile: { completedAt: new Date() } });

    const actions = await service.repairAll(500, true);

    expect(actions).toEqual([{ userId, action: 'assignPlan', ok: true }]);
    expect(planService.assignPlan).not.toHaveBeenCalled();
  });

  it('repair apply should assign missing plans through the single writer', async () => {
    scanUser({ profile: { completedAt: new Date() } });
    prisma.userPlan.findUnique.mockResolvedValue(null);

    const actions = await service.repairAll(500, false);

    expect(planService.assignPlan).toHaveBeenCalledWith(userId, undefined);
    expect(actions).toEqual([{ userId, action: 'assignPlan', ok: true }]);
  });

  it('repair failures should be reported per user without aborting', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    prisma.userPlan.findUnique.mockResolvedValue(null);
    prisma.onboardingProfile.findUnique.mockResolvedValue({
      completedAt: new Date(),
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'x', goalType: null });
    planService.assignPlan
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({} as any);

    const actions = await service.repairAll(500, false);

    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ userId: 'u1', ok: false });
    expect(actions[1]).toMatchObject({ userId: 'u2', ok: true });
  });
});
