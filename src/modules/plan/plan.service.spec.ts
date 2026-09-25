import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PlanService } from './plan.service';
import { PlanRepository } from './repositories/plan.repository';
import { WorkoutsRepository } from '../workouts/repositories/workouts.repository';
import { RecommendationService } from '../recommendation/recommendation.service';
import { PlanDayStatus } from '@prisma/client';
import { getMondayOfWeek, addDaysUTC } from './utils/date.utils';

describe('PlanService', () => {
  let service: PlanService;
  let planRepo: jest.Mocked<PlanRepository>;
  let workoutsRepo: jest.Mocked<WorkoutsRepository>;
  let recommendationService: jest.Mocked<RecommendationService>;

  const userId = 'user-uuid-1111';
  const otherUserId = 'user-uuid-2222';
  const workoutId = 'workout-uuid-3333';
  const monday = getMondayOfWeek(new Date());

  const mockPlanDay = {
    id: 'day-uuid-1',
    weeklyPlanId: 'plan-uuid-1',
    date: monday,
    workoutId,
    isRestDay: false,
    status: PlanDayStatus.UPCOMING,
    workout: {
      id: workoutId,
      programId: 'prog-1',
      title: 'Pecho Power',
      durationMinutes: 45,
      difficulty: 'Intermedio',
      kcalEstimate: 400,
      imageAssetName: 'img',
      rounds: 4,
    },
    weeklyPlan: {
      id: 'plan-uuid-1',
      userId,
      weekStartDate: monday,
    },
  };

  const mockWeeklyPlan = {
    id: 'plan-uuid-1',
    userId,
    weekStartDate: monday,
    days: [mockPlanDay],
  };

  beforeEach(async () => {
    const mockPlanRepo = {
      findWeeklyPlanByWeek: jest.fn(),
      findLatestWeeklyPlanBefore: jest.fn(),
      createWeeklyPlanWithDays: jest.fn(),
      findPlanDayById: jest.fn(),
      updatePlanDay: jest.fn(),
    };

    const mockWorkoutsRepo = {
      findById: jest.fn(),
    };

    const mockRecommendationService = {
      generateWeeklyPlan: jest.fn(),
      resolveExerciseForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanService,
        { provide: PlanRepository, useValue: mockPlanRepo },
        { provide: WorkoutsRepository, useValue: mockWorkoutsRepo },
        { provide: RecommendationService, useValue: mockRecommendationService },
      ],
    }).compile();

    service = module.get<PlanService>(PlanService);
    planRepo = module.get(PlanRepository);
    workoutsRepo = module.get(WorkoutsRepository);
    recommendationService = module.get(RecommendationService);
  });

  describe('getCurrentPlan', () => {
    it('should return existing plan if already present', async () => {
      planRepo.findWeeklyPlanByWeek.mockResolvedValue(mockWeeklyPlan as any);

      const result = await service.getCurrentPlan(userId);

      expect(planRepo.findWeeklyPlanByWeek).toHaveBeenCalledWith(
        userId,
        monday,
      );
      expect(result.id).toBe(mockWeeklyPlan.id);
      expect(result.days).toHaveLength(1);
    });

    it('should auto-generate weekly plan via RecommendationService when no plan exists', async () => {
      planRepo.findWeeklyPlanByWeek.mockResolvedValue(null);

      const generatedPlan = {
        ...mockWeeklyPlan,
        days: Array.from({ length: 7 }, (_, i) => ({
          id: `day-${i}`,
          weeklyPlanId: 'plan-uuid-1',
          date: addDaysUTC(monday, i),
          workoutId: i % 2 === 0 ? workoutId : null,
          isRestDay: i % 2 !== 0,
          status: PlanDayStatus.UPCOMING,
          workout: null,
        })),
      };

      recommendationService.generateWeeklyPlan.mockResolvedValue(
        generatedPlan as any,
      );

      const result = await service.getCurrentPlan(userId);

      expect(recommendationService.generateWeeklyPlan).toHaveBeenCalledWith(
        userId,
        monday,
      );
      expect(result.days).toHaveLength(7);
      expect(result.days[0].workoutId).toBe(workoutId);
      expect(result.days[1].isRestDay).toBe(true);
    });
  });

  describe('updatePlanDay', () => {
    it('should update workoutId and set isRestDay: false for plan owner', async () => {
      planRepo.findPlanDayById.mockResolvedValue(mockPlanDay as any);
      workoutsRepo.findById.mockResolvedValue(mockPlanDay.workout as any);
      planRepo.updatePlanDay.mockResolvedValue({
        ...mockPlanDay,
        workoutId: 'new-workout-id',
        isRestDay: false,
      } as any);

      const result = await service.updatePlanDay(mockPlanDay.id, userId, {
        workoutId: 'new-workout-id',
      });

      expect(workoutsRepo.findById).toHaveBeenCalledWith('new-workout-id');
      expect(planRepo.updatePlanDay).toHaveBeenCalledWith(mockPlanDay.id, {
        workoutId: 'new-workout-id',
        isRestDay: false,
      });
      expect(result.workoutId).toBe('new-workout-id');
      expect(result.isRestDay).toBe(false);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      planRepo.findPlanDayById.mockResolvedValue(mockPlanDay as any);

      await expect(
        service.updatePlanDay(mockPlanDay.id, otherUserId, {
          isRestDay: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if planDay does not exist', async () => {
      planRepo.findPlanDayById.mockResolvedValue(null);

      await expect(
        service.updatePlanDay('unknown-id', userId, { isRestDay: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if assigned workoutId does not exist', async () => {
      planRepo.findPlanDayById.mockResolvedValue(mockPlanDay as any);
      workoutsRepo.findById.mockResolvedValue(null);

      await expect(
        service.updatePlanDay(mockPlanDay.id, userId, {
          workoutId: 'non-existent-workout',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
