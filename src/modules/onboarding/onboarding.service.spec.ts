import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingRepository } from './repositories/onboarding.repository';
import { EquipmentRepository } from '../equipment/repositories/equipment.repository';
import { RecommendationService } from '../recommendation/recommendation.service';
import { ExperienceLevel, GoalType } from '@prisma/client';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let onboardingRepo: jest.Mocked<OnboardingRepository>;
  let equipmentRepo: jest.Mocked<EquipmentRepository>;
  let recommendationService: jest.Mocked<RecommendationService>;

  const userId = 'user-uuid-1111';
  const equipmentId = '88888888-8888-4888-8888-888888888881';

  const mockProfile = {
    id: 'onboarding-uuid-1',
    userId,
    goal: GoalType.LOSE_WEIGHT,
    experienceLevel: ExperienceLevel.INTERMEDIATE,
    workoutDaysPerWeek: 4,
    completedAt: new Date('2026-09-24T12:00:00.000Z'),
  };

  beforeEach(async () => {
    const mockOnboardingRepo = {
      findByUserId: jest.fn(),
      upsertProfile: jest.fn(),
    };

    const mockEquipmentRepo = {
      getUserEquipmentPreferences: jest.fn(),
      replaceUserEquipmentPreferences: jest.fn(),
    };

    const mockRecommendationService = {
      generateWeeklyPlan: jest.fn().mockResolvedValue({} as any),
      resolveExerciseForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: OnboardingRepository, useValue: mockOnboardingRepo },
        { provide: EquipmentRepository, useValue: mockEquipmentRepo },
        { provide: RecommendationService, useValue: mockRecommendationService },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    onboardingRepo = module.get(OnboardingRepository);
    equipmentRepo = module.get(EquipmentRepository);
    recommendationService = module.get(RecommendationService);
  });

  describe('getProfile', () => {
    it('should return profile and equipment preferences when completed', async () => {
      onboardingRepo.findByUserId.mockResolvedValue(mockProfile);
      equipmentRepo.getUserEquipmentPreferences.mockResolvedValue([
        equipmentId,
      ]);

      const result = await service.getProfile(userId);

      expect(onboardingRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(equipmentRepo.getUserEquipmentPreferences).toHaveBeenCalledWith(
        userId,
      );
      expect(result.id).toBe(mockProfile.id);
      expect(result.goal).toBe(GoalType.LOSE_WEIGHT);
      expect(result.equipmentIds).toEqual([equipmentId]);
    });

    it('should throw NotFoundException when profile is not found', async () => {
      onboardingRepo.findByUserId.mockResolvedValue(null);

      await expect(service.getProfile(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when completedAt is null', async () => {
      onboardingRepo.findByUserId.mockResolvedValue({
        ...mockProfile,
        completedAt: null,
      });

      await expect(service.getProfile(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeOnboarding', () => {
    it('should replace equipment preferences, upsert profile and trigger plan generation', async () => {
      equipmentRepo.replaceUserEquipmentPreferences.mockResolvedValue([
        equipmentId,
      ]);
      onboardingRepo.upsertProfile.mockResolvedValue(mockProfile);

      const result = await service.completeOnboarding(userId, {
        goal: GoalType.LOSE_WEIGHT,
        experienceLevel: ExperienceLevel.INTERMEDIATE,
        workoutDaysPerWeek: 4,
        equipmentIds: [equipmentId],
      });

      expect(
        equipmentRepo.replaceUserEquipmentPreferences,
      ).toHaveBeenCalledWith(userId, [equipmentId]);
      expect(onboardingRepo.upsertProfile).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          goal: GoalType.LOSE_WEIGHT,
          experienceLevel: ExperienceLevel.INTERMEDIATE,
          workoutDaysPerWeek: 4,
          completedAt: expect.any(Date),
        }),
      );
      expect(recommendationService.generateWeeklyPlan).toHaveBeenCalledWith(
        userId,
        expect.any(Date),
      );
      expect(result.id).toBe(mockProfile.id);
      expect(result.equipmentIds).toEqual([equipmentId]);
    });
  });
});
