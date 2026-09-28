import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PlanService } from './plan.service';
import { PlanRepository } from './repositories/plan.repository';
import { WorkoutsRepository } from '../workouts/repositories/workouts.repository';
import { WorkoutsService } from '../workouts/workouts.service';
import { RecommendationService } from '../recommendation/recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DayOfWeek,
  ExperienceLevel,
  GoalType,
  PlanDayStatus,
  PlanType,
  ProgramCategory,
  ProgramLevel,
  ProgramLocation,
  ScheduleOrigin,
} from '@prisma/client';
import { getMondayOfWeek } from './utils/date.utils';

/**
 * Fase 2 plan consistency (invariants 1-4, 7):
 * - one canonical UserPlan, single schedule writer, single reader.
 */
describe('PlanService consistency (Fase 2)', () => {
  let service: PlanService;
  let prisma: any;
  let tx: any;
  let recommendationService: any;
  let workoutsService: any;
  let workoutsRepo: any;

  const userId = 'user-consistency-1';
  const workoutA = 'workout-uuid-aaaa';
  const workoutB = 'workout-uuid-bbbb';
  const programId = 'program-uuid-preset';

  const mockProgram: any = {
    id: programId,
    title: 'Fuerza Total',
    category: ProgramCategory.MUSCLE_GAIN,
    durationWeeks: 8,
    level: ProgramLevel.INTERMEDIATE,
    location: ProgramLocation.GYM,
    tagline: 't',
    imageAssetName: 'img',
  };

  const blueprint: any = {
    goal: GoalType.GAIN_MUSCLE,
    experienceLevel: ExperienceLevel.INTERMEDIATE,
    workoutDaysPerWeek: 3,
    chosenProgram: {
      ...mockProgram,
      workouts: [
        { id: workoutA, title: 'A' },
        { id: workoutB, title: 'B' },
      ],
    },
    weekNumber: 1,
    totalWeeks: 8,
    programStartDate: getMondayOfWeek(new Date()),
    planDaysData: [],
  };

  const persistedWeek: any = {
    id: 'week-1',
    userId,
    weekStartDate: getMondayOfWeek(new Date()),
    programId,
    weekNumber: 1,
    totalWeeks: 8,
    program: mockProgram,
    days: [],
  };

  beforeEach(async () => {
    tx = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      userPlan: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      goal: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      weightEntry: { findFirst: jest.fn() },
      onboardingProfile: { findUnique: jest.fn() },
      weeklyPlan: {
        findFirst: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      planDay: { deleteMany: jest.fn() },
      customRoutineDayAssignment: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      program: { findUnique: jest.fn() },
      workout: { findUnique: jest.fn() },
      workoutSession: { findMany: jest.fn().mockResolvedValue([]) },
    };

    prisma = {
      program: { findUnique: jest.fn() },
      userPlan: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      user: { findUnique: jest.fn(), update: jest.fn() },
      goal: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      weightEntry: { findFirst: jest.fn() },
      onboardingProfile: { findUnique: jest.fn() },
      weeklyPlan: { findFirst: jest.fn() },
      customRoutineDayAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      workout: { findUnique: jest.fn() },
      workoutSession: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    recommendationService = {
      generateWeeklyPlan: jest.fn(),
      resolveExerciseForUser: jest.fn(),
      resolveBlueprint: jest.fn(),
      persistBlueprint: jest.fn(),
    };

    workoutsService = {
      getWorkoutById: jest.fn(async (id: string) => ({
        id,
        title: `Workout ${id.slice(0, 4)}`,
        exercises: [],
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: PlanRepository,
          useValue: {
            findWeeklyPlanByWeek: jest.fn(),
            updatePlanDay: jest.fn(),
            findPlanDayById: jest.fn(),
          },
        },
        { provide: WorkoutsRepository, useValue: { findById: jest.fn() } },
        { provide: WorkoutsService, useValue: workoutsService },
        { provide: RecommendationService, useValue: recommendationService },
      ],
    }).compile();

    service = module.get<PlanService>(PlanService);
    workoutsRepo = module.get(WorkoutsRepository);
  });

  describe('invariant 2: assignPlan runs in ONE transaction', () => {
    it('should resolve, persist, align goal and rewrite schedule in a single $transaction', async () => {
      prisma.program.findUnique.mockResolvedValue(mockProgram);
      recommendationService.resolveBlueprint.mockResolvedValue(blueprint);
      recommendationService.persistBlueprint.mockResolvedValue(persistedWeek);
      tx.goal.findFirst.mockResolvedValue({
        id: 'goal-1',
        type: GoalType.GAIN_MUSCLE,
      });
      prisma.userPlan.findUnique.mockResolvedValue({
        userId,
        planType: PlanType.PRESET,
        programId,
        goal: GoalType.GAIN_MUSCLE,
        startedAt: new Date(),
        program: mockProgram,
      });

      const { weeklyPlan } = await service.assignPlan(userId, programId);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(recommendationService.resolveBlueprint).toHaveBeenCalledWith(
        userId,
        expect.any(Date),
        programId,
      );
      expect(recommendationService.persistBlueprint).toHaveBeenCalledWith(
        expect.anything(),
        userId,
        expect.any(Date),
        blueprint,
        expect.objectContaining({
          userPlan: { planType: PlanType.PRESET, programId },
          scheduleOrigin: ScheduleOrigin.PRESET_GENERATED,
        }),
      );
      // Goal alignment happened inside the same tx (no new Goal row needed).
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { goalType: GoalType.GAIN_MUSCLE },
      });
      expect(tx.goal.create).not.toHaveBeenCalled();
      expect(weeklyPlan).toBeDefined();
    });

    it('should create a Goal row when the plan goal has none (no duplication on re-assign)', async () => {
      prisma.program.findUnique.mockResolvedValue(mockProgram);
      recommendationService.resolveBlueprint.mockResolvedValue(blueprint);
      recommendationService.persistBlueprint.mockResolvedValue(persistedWeek);
      tx.goal.findFirst.mockResolvedValue(null);
      tx.weightEntry.findFirst.mockResolvedValue({ weightKg: 80 });
      tx.onboardingProfile.findUnique.mockResolvedValue({
        targetWeightKg: 85,
        currentWeightKg: 80,
      });
      tx.user.findUnique.mockResolvedValue({ targetWeightKg: 85 });
      prisma.userPlan.findUnique.mockResolvedValue({
        userId,
        planType: PlanType.PRESET,
        programId,
        goal: GoalType.GAIN_MUSCLE,
        startedAt: new Date(),
        program: mockProgram,
      });

      await service.assignPlan(userId, programId);

      expect(tx.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          type: GoalType.GAIN_MUSCLE,
          currentValue: 80,
        }),
      });
    });
  });

  describe('invariant 1: explicit none state (HTTP 200 shaped, never 404)', () => {
    it('should return state none with empty schedule when the user has no UserPlan', async () => {
      prisma.userPlan.findUnique.mockResolvedValue(null);

      const state = await service.getPlanState(userId, 'UTC');

      expect(state.state).toBe('none');
      expect(state.plan).toBeNull();
      expect(state.schedule).toEqual([]);
      expect(state.today.status).toBe('none');
    });
  });

  describe('invariant 4 + bug repro: one truth for schedule/today/plan', () => {
    const presetPlan: any = {
      userId,
      planType: PlanType.PRESET,
      programId,
      goal: GoalType.GAIN_MUSCLE,
      startedAt: new Date(),
      program: mockProgram,
    };

    it('preset rest day: schedule, today and plan agree (no more X vs descanso vs Sin asignar)', async () => {
      prisma.userPlan.findUnique.mockResolvedValue(presetPlan);
      // Exact bug setup, weekday-agnostic: every scheduled day is rest and
      // there are no "empty filler" rows left behind.
      const { DAYS_OF_WEEK_ORDER: order } = await import('./utils/date.utils');
      prisma.customRoutineDayAssignment.findMany.mockResolvedValue(
        order.map((dayOfWeek, i) => ({
          id: `row-${i}`,
          userId,
          dayOfWeek,
          workoutId: null,
          isRestDay: true,
          origin: ScheduleOrigin.PRESET_GENERATED,
        })),
      );
      prisma.onboardingProfile.findUnique.mockResolvedValue({
        experienceLevel: ExperienceLevel.INTERMEDIATE,
      });

      const state = await service.getPlanState(userId, 'UTC');

      expect(state.state).toBe('active');
      expect(state.plan?.type).toBe('preset');
      expect(state.schedule).toHaveLength(7);
      expect(state.schedule.every((d) => d.status === 'rest')).toBe(true);
      // Today card derives from the SAME schedule rows.
      expect(state.today.status).toBe('rest');
      expect(state.today.targetDay).toBe('today');
      expect(state.today.isTodayCompleted).toBe(false);
    });

    it('custom plan with an unassigned today reports unassigned explicitly (never rest)', async () => {
      prisma.userPlan.findUnique.mockResolvedValue({
        userId,
        planType: PlanType.CUSTOM,
        programId: null,
        goal: GoalType.IMPROVE_HEALTH,
        startedAt: new Date(),
        program: null,
      });
      prisma.customRoutineDayAssignment.findMany.mockResolvedValue([]);

      const state = await service.getPlanState(userId, 'UTC');

      expect(state.state).toBe('active');
      expect(state.plan?.type).toBe('custom');
      expect(state.schedule).toHaveLength(7);
      expect(state.schedule.every((d) => d.status === 'unassigned')).toBe(true);
      expect(state.today.status).toBe('unassigned');
    });

    it('completed session today rotates the card to tomorrow from the same schedule', async () => {
      const now = new Date();
      const toDay = (d: Date) =>
        (
          [
            DayOfWeek.SUNDAY,
            DayOfWeek.MONDAY,
            DayOfWeek.TUESDAY,
            DayOfWeek.WEDNESDAY,
            DayOfWeek.THURSDAY,
            DayOfWeek.FRIDAY,
            DayOfWeek.SATURDAY,
          ] as DayOfWeek[]
        )[d.getDay()];
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      prisma.userPlan.findUnique.mockResolvedValue({
        userId,
        planType: PlanType.CUSTOM,
        programId: null,
        goal: GoalType.IMPROVE_HEALTH,
        startedAt: new Date(),
        program: null,
      });
      prisma.customRoutineDayAssignment.findMany.mockResolvedValue([
        {
          id: 'row-tomorrow',
          userId,
          dayOfWeek: toDay(tomorrow),
          workoutId: workoutA,
          isRestDay: false,
          origin: ScheduleOrigin.MANUAL,
        },
      ]);
      prisma.workoutSession.findMany.mockResolvedValue([
        { id: 's1', date: now, status: 'COMPLETED' },
      ]);

      const state = await service.getPlanState(userId, 'UTC');

      expect(state.today.isTodayCompleted).toBe(true);
      expect(state.today.targetDay).toBe('tomorrow');
    });
  });

  describe('custom path: manual edits own the CUSTOM plan', () => {
    it('should create a CUSTOM UserPlan on first manual edit and stamp MANUAL origin', async () => {
      prisma.userPlan.findUnique.mockResolvedValue(null);
      prisma.onboardingProfile.findUnique.mockResolvedValue({
        goal: GoalType.LOSE_WEIGHT,
      });
      prisma.user.findUnique.mockResolvedValue({ goalType: null });
      prisma.workout.findUnique.mockResolvedValue({
        id: workoutA,
        ownerUserId: userId,
      });
      tx.userPlan.findUnique.mockResolvedValue(null);
      tx.onboardingProfile.findUnique.mockResolvedValue({
        goal: GoalType.LOSE_WEIGHT,
      });
      tx.user.findUnique.mockResolvedValue({ goalType: null });
      tx.customRoutineDayAssignment.upsert.mockResolvedValue({
        id: 'row-1',
        userId,
        dayOfWeek: DayOfWeek.MONDAY,
        workoutId: workoutA,
        isRestDay: false,
        origin: ScheduleOrigin.MANUAL,
        workout: {
          id: workoutA,
          title: 'Mi Rutina',
          durationMinutes: 40,
          kcalEstimate: 300,
          imageAssetName: 'img',
          exercises: [{}, {}],
        },
      });

      const result = await service.upsertCustomScheduleDay(
        userId,
        DayOfWeek.MONDAY,
        {
          workoutId: workoutA,
        } as any,
      );

      expect(tx.userPlan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          planType: PlanType.CUSTOM,
          programId: null,
        }),
      });
      expect(tx.customRoutineDayAssignment.deleteMany).not.toHaveBeenCalled();
      expect(result.workoutId).toBe(workoutA);
    });

    it('should convert PRESET to CUSTOM keeping existing rows (no schedule wipe)', async () => {
      tx.userPlan.findUnique.mockResolvedValue({
        userId,
        planType: PlanType.PRESET,
        programId,
      });
      prisma.workout.findUnique.mockResolvedValue({
        id: workoutA,
        ownerUserId: userId,
      });
      tx.customRoutineDayAssignment.upsert.mockResolvedValue({
        id: 'row-1',
        userId,
        dayOfWeek: DayOfWeek.MONDAY,
        workoutId: null,
        isRestDay: true,
        origin: ScheduleOrigin.MANUAL,
        workout: null,
      });

      await service.upsertCustomScheduleDay(userId, DayOfWeek.MONDAY, {
        isRestDay: true,
      } as any);

      expect(tx.userPlan.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          planType: PlanType.CUSTOM,
          programId: null,
        }),
      });
      expect(tx.customRoutineDayAssignment.deleteMany).not.toHaveBeenCalled();
    });

    it('should reject a catalog workout (ownership rule preserved)', async () => {
      prisma.workout.findUnique.mockResolvedValue({
        id: workoutA,
        ownerUserId: 'someone-else',
      });

      await expect(
        service.upsertCustomScheduleDay(userId, DayOfWeek.MONDAY, {
          workoutId: workoutA,
        } as any),
      ).rejects.toThrow();
    });
  });

  describe('single-writer guard on PATCH /plan/days', () => {
    it('should reject real assignment changes with 409', async () => {
      const planRepo: any = (service as any).planRepository;
      planRepo.findPlanDayById.mockResolvedValue({
        id: 'day-1',
        workoutId: workoutA,
        isRestDay: false,
        status: PlanDayStatus.UPCOMING,
        weeklyPlan: { userId },
      });

      await expect(
        service.updatePlanDay('day-1', userId, { workoutId: workoutB } as any),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.updatePlanDay('day-1', userId, { isRestDay: true } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow status-only updates (toggle flow keeps working)', async () => {
      const planRepo: any = (service as any).planRepository;
      planRepo.findPlanDayById.mockResolvedValue({
        id: 'day-1',
        workoutId: workoutA,
        isRestDay: false,
        status: PlanDayStatus.UPCOMING,
        weeklyPlan: { userId },
      });
      workoutsRepo.findById.mockResolvedValue({ id: workoutA });
      planRepo.updatePlanDay.mockResolvedValue({
        id: 'day-1',
        weeklyPlanId: 'week-1',
        date: new Date(),
        workoutId: workoutA,
        isRestDay: false,
        status: PlanDayStatus.COMPLETED,
      });

      await service.updatePlanDay('day-1', userId, {
        workoutId: workoutA,
        isRestDay: false,
        status: PlanDayStatus.COMPLETED,
      } as any);

      expect(planRepo.updatePlanDay).toHaveBeenCalled();
    });
  });
});
