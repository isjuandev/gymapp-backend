import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { PlanService } from '../plan/plan.service';
import { DayOfWeek, PlanDayStatus } from '@prisma/client';

describe('HomeService', () => {
  let service: HomeService;
  let prisma: {
    customRoutineDayAssignment: {
      findUnique: jest.Mock;
    };
    workoutSession: {
      findMany: jest.Mock;
    };
  };
  let workoutsService: {
    getWorkoutById: jest.Mock;
  };
  let planService: {
    getPlanByWeek: jest.Mock;
  };

  const userId = 'user-home-test-123';

  beforeEach(async () => {
    prisma = {
      customRoutineDayAssignment: {
        findUnique: jest.fn(),
      },
      workoutSession: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    workoutsService = {
      getWorkoutById: jest.fn(),
    };

    planService = {
      getPlanByWeek: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: WorkoutsService,
          useValue: workoutsService,
        },
        {
          provide: PlanService,
          useValue: planService,
        },
      ],
    }).compile();

    service = module.get<HomeService>(HomeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveDayInTimezone', () => {
    it('should use provided valid IANA timezone', () => {
      const res = service.resolveDayInTimezone('America/Bogota');
      expect(res.effectiveTimezone).toBe('America/Bogota');
      expect(Object.values(DayOfWeek)).toContain(res.dayOfWeek);
      expect(res.dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should fallback to UTC when timezone is invalid or omitted', () => {
      const resInvalid = service.resolveDayInTimezone('Invalid/Zone_Name');
      expect(resInvalid.effectiveTimezone).toBe('UTC');

      const resOmitted = service.resolveDayInTimezone(undefined);
      expect(resOmitted.effectiveTimezone).toBe('UTC');

      const resEmpty = service.resolveDayInTimezone('   ');
      expect(resEmpty.effectiveTimezone).toBe('UTC');
    });
  });

  describe('getTodayWorkout', () => {
    it('Priority 1a: should return custom workout when assignment has workoutId', async () => {
      const { dayOfWeek } = service.resolveDayInTimezone('UTC');

      prisma.customRoutineDayAssignment.findUnique.mockResolvedValue({
        id: 'assign-1',
        userId,
        dayOfWeek,
        workoutId: 'workout-custom-1',
        isRestDay: false,
      });

      const mockResolvedWorkout: any = {
        id: 'workout-custom-1',
        title: 'Mi Rutina Custom',
        isCustom: true,
        exercises: [],
      };
      workoutsService.getWorkoutById.mockResolvedValue(mockResolvedWorkout);

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.source).toBe('custom');
      expect(result.workout).toBe(mockResolvedWorkout);
      expect(result.dayOfWeek).toBe(dayOfWeek);
      expect(result.timezone).toBe('UTC');
      expect(workoutsService.getWorkoutById).toHaveBeenCalledWith(
        'workout-custom-1',
        userId,
      );
      expect(planService.getPlanByWeek).not.toHaveBeenCalled();
    });

    it('Priority 1b: should return restDay when assignment has isRestDay: true', async () => {
      const { dayOfWeek } = service.resolveDayInTimezone('UTC');

      prisma.customRoutineDayAssignment.findUnique.mockResolvedValue({
        id: 'assign-2',
        userId,
        dayOfWeek,
        workoutId: null,
        isRestDay: true,
      });

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.source).toBe('restDay');
      expect(result.workout).toBeUndefined();
      expect(result.dayOfWeek).toBe(dayOfWeek);
      expect(workoutsService.getWorkoutById).not.toHaveBeenCalled();
      expect(planService.getPlanByWeek).not.toHaveBeenCalled();
    });

    it('Priority 2a: should fall back to recommended plan workout when no custom assignment exists', async () => {
      const { dayOfWeek, dateString } = service.resolveDayInTimezone('UTC');

      prisma.customRoutineDayAssignment.findUnique.mockResolvedValue(null);

      const mockPlanDay = {
        id: 'plan-day-1',
        weeklyPlanId: 'week-1',
        date: `${dateString}T00:00:00.000Z`,
        workoutId: 'workout-recommended-1',
        isRestDay: false,
        status: PlanDayStatus.UPCOMING,
      };

      planService.getPlanByWeek.mockResolvedValue({
        id: 'week-1',
        userId,
        weekStartDate: '2026-09-21T00:00:00.000Z',
        days: [mockPlanDay],
      });

      const mockRecommendedWorkout: any = {
        id: 'workout-recommended-1',
        title: 'Fuerza Total',
        isCustom: false,
        exercises: [],
      };
      workoutsService.getWorkoutById.mockResolvedValue(mockRecommendedWorkout);

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.source).toBe('recommended');
      expect(result.workout).toBe(mockRecommendedWorkout);
      expect(result.dayOfWeek).toBe(dayOfWeek);
      expect(workoutsService.getWorkoutById).toHaveBeenCalledWith(
        'workout-recommended-1',
        userId,
      );
    });

    it('Priority 2b: should return restDay when recommended plan marks today as rest day', async () => {
      const { dayOfWeek, dateString } = service.resolveDayInTimezone('UTC');

      prisma.customRoutineDayAssignment.findUnique.mockResolvedValue(null);

      const mockPlanDay = {
        id: 'plan-day-rest',
        weeklyPlanId: 'week-1',
        date: `${dateString}T00:00:00.000Z`,
        workoutId: null,
        isRestDay: true,
        status: PlanDayStatus.UPCOMING,
      };

      planService.getPlanByWeek.mockResolvedValue({
        id: 'week-1',
        userId,
        weekStartDate: '2026-09-21T00:00:00.000Z',
        days: [mockPlanDay],
      });

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.source).toBe('restDay');
      expect(result.workout).toBeUndefined();
      expect(workoutsService.getWorkoutById).not.toHaveBeenCalled();
    });

    it('Priority 3: should return none when user has no custom schedule and no recommended plan', async () => {
      prisma.customRoutineDayAssignment.findUnique.mockResolvedValue(null);
      planService.getPlanByWeek.mockRejectedValue(
        new Error('User onboarding profile not found or incomplete'),
      );

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.source).toBe('none');
      expect(result.workout).toBeUndefined();
    });

    it('should fallback to recommended plan if custom workout was deleted/not found', async () => {
      const { dayOfWeek, dateString } = service.resolveDayInTimezone('UTC');

      prisma.customRoutineDayAssignment.findUnique.mockResolvedValue({
        id: 'assign-deleted',
        userId,
        dayOfWeek,
        workoutId: 'deleted-workout-id',
        isRestDay: false,
      });

      workoutsService.getWorkoutById.mockRejectedValueOnce(
        new Error('Workout not found'),
      );

      const mockPlanDay = {
        id: 'plan-day-fallback',
        weeklyPlanId: 'week-1',
        date: `${dateString}T00:00:00.000Z`,
        workoutId: 'fallback-workout-1',
        isRestDay: false,
        status: PlanDayStatus.UPCOMING,
      };

      planService.getPlanByWeek.mockResolvedValue({
        id: 'week-1',
        userId,
        weekStartDate: '2026-09-21T00:00:00.000Z',
        days: [mockPlanDay],
      });

      const mockFallbackWorkout: any = {
        id: 'fallback-workout-1',
        title: 'Fallback Workout',
        exercises: [],
      };
      workoutsService.getWorkoutById.mockResolvedValueOnce(mockFallbackWorkout);

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.source).toBe('recommended');
      expect(result.workout).toBe(mockFallbackWorkout);
      expect(result.targetDay).toBe('today');
      expect(result.isTodayCompleted).toBe(false);
    });

    it('should rotate to tomorrow workout when today workout session is already completed', async () => {
      const todayInfo = service.resolveDayInTimezone('UTC');
      const tomorrowInfo = service.resolveDayInTimezone(
        'UTC',
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );

      // Simulate a completed session today
      prisma.workoutSession.findMany.mockResolvedValue([
        {
          id: 'session-completed-today',
          userId,
          status: 'COMPLETED',
          date: new Date(`${todayInfo.dateString}T10:00:00.000Z`),
        },
      ]);

      // Tomorrow has a custom assignment
      prisma.customRoutineDayAssignment.findUnique.mockImplementation(
        async ({ where }: any) => {
          if (where.userId_dayOfWeek.dayOfWeek === tomorrowInfo.dayOfWeek) {
            return {
              id: 'assign-tomorrow',
              userId,
              dayOfWeek: tomorrowInfo.dayOfWeek,
              workoutId: 'workout-tomorrow-id',
              isRestDay: false,
            };
          }
          return null;
        },
      );

      const mockTomorrowWorkout: any = {
        id: 'workout-tomorrow-id',
        title: 'Tomorrow Workout Power',
        exercises: [],
      };
      workoutsService.getWorkoutById.mockResolvedValue(mockTomorrowWorkout);

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.targetDay).toBe('tomorrow');
      expect(result.isTodayCompleted).toBe(true);
      expect(result.source).toBe('custom');
      expect(result.dayOfWeek).toBe(tomorrowInfo.dayOfWeek);
      expect(result.workout).toBe(mockTomorrowWorkout);
    });
  });
});
