import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkoutsService } from '../workouts/workouts.service';
import { PlanService } from '../plan/plan.service';
import { DayOfWeek, ScheduleOrigin } from '@prisma/client';

/**
 * HomeService is a thin projection over PlanService.getPlanState (Fase 2).
 * These tests verify the source mapping, not the resolution itself
 * (resolution is covered by plan-consistency specs).
 */
describe('HomeService', () => {
  let service: HomeService;
  let planService: {
    getPlanState: jest.Mock;
  };

  const userId = 'user-home-test-123';

  const baseState = (today: any) => ({
    state: 'active',
    plan: {
      type: 'preset',
      programId: 'prog-1',
      programTitle: 'Programa',
      goal: 'LOSE_WEIGHT',
      weekNumber: 1,
      totalWeeks: 12,
      startedAt: new Date().toISOString(),
    },
    schedule: [],
    today,
  });

  beforeEach(async () => {
    planService = {
      getPlanState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        { provide: PrismaService, useValue: {} },
        { provide: WorkoutsService, useValue: {} },
        { provide: PlanService, useValue: planService },
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
      expect(
        service.resolveDayInTimezone('Invalid/Zone_Name').effectiveTimezone,
      ).toBe('UTC');
      expect(
        service.resolveDayInTimezone(undefined).effectiveTimezone,
      ).toBe('UTC');
      expect(service.resolveDayInTimezone('   ').effectiveTimezone).toBe(
        'UTC',
      );
    });
  });

  describe('getTodayWorkout (projection over plan state)', () => {
    it('should map MANUAL workout days to source custom', async () => {
      const workout: any = { id: 'w-custom', title: 'Mi Rutina' };
      planService.getPlanState.mockResolvedValue(
        baseState({
          date: '2026-09-28',
          dayOfWeek: DayOfWeek.MONDAY,
          status: 'workout',
          targetDay: 'today',
          isTodayCompleted: false,
          workout,
          origin: ScheduleOrigin.MANUAL,
          timezone: 'UTC',
        }),
      );

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(planService.getPlanState).toHaveBeenCalledWith(userId, 'UTC');
      expect(result.source).toBe('custom');
      expect(result.workout).toBe(workout);
      expect(result.targetDay).toBe('today');
      expect(result.isTodayCompleted).toBe(false);
    });

    it('should map PRESET_GENERATED workout days to source recommended', async () => {
      const workout: any = { id: 'w-preset', title: 'Fuerza' };
      planService.getPlanState.mockResolvedValue(
        baseState({
          date: '2026-09-28',
          dayOfWeek: DayOfWeek.MONDAY,
          status: 'workout',
          targetDay: 'today',
          isTodayCompleted: false,
          workout,
          origin: ScheduleOrigin.PRESET_GENERATED,
          timezone: 'UTC',
        }),
      );

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.source).toBe('recommended');
      expect(result.workout).toBe(workout);
    });

    it('should map rest days to source restDay and unassigned/none to none', async () => {
      planService.getPlanState.mockResolvedValue(
        baseState({
          date: '2026-09-28',
          dayOfWeek: DayOfWeek.SUNDAY,
          status: 'rest',
          targetDay: 'today',
          isTodayCompleted: false,
          workout: null,
          origin: null,
          timezone: 'UTC',
        }),
      );
      expect((await service.getTodayWorkout(userId)).source).toBe('restDay');

      planService.getPlanState.mockResolvedValue(
        baseState({
          date: '2026-09-28',
          dayOfWeek: DayOfWeek.SUNDAY,
          status: 'unassigned',
          targetDay: 'today',
          isTodayCompleted: false,
          workout: null,
          origin: null,
          timezone: 'UTC',
        }),
      );
      expect((await service.getTodayWorkout(userId)).source).toBe('none');

      planService.getPlanState.mockResolvedValue({
        state: 'none',
        plan: null,
        schedule: [],
        today: {
          date: '2026-09-28',
          dayOfWeek: DayOfWeek.SUNDAY,
          status: 'none',
          targetDay: 'today',
          isTodayCompleted: false,
          workout: null,
          origin: null,
          timezone: 'UTC',
        },
      });
      const noneResult = await service.getTodayWorkout(userId);
      expect(noneResult.source).toBe('none');
      expect(noneResult.workout).toBeUndefined();
    });

    it('should pass through tomorrow rotation from plan state', async () => {
      const workout: any = { id: 'w-tomorrow', title: 'Mañana' };
      planService.getPlanState.mockResolvedValue(
        baseState({
          date: '2026-09-29',
          dayOfWeek: DayOfWeek.TUESDAY,
          status: 'workout',
          targetDay: 'tomorrow',
          isTodayCompleted: true,
          workout,
          origin: ScheduleOrigin.MANUAL,
          timezone: 'UTC',
        }),
      );

      const result = await service.getTodayWorkout(userId, 'UTC');

      expect(result.targetDay).toBe('tomorrow');
      expect(result.isTodayCompleted).toBe(true);
      expect(result.source).toBe('custom');
      expect(result.dayOfWeek).toBe(DayOfWeek.TUESDAY);
    });
  });
});
