import { Injectable, NotFoundException } from '@nestjs/common';
import { OnboardingProfile } from '@prisma/client';
import { CompleteOnboardingDto, OnboardingProfileResponseDto } from './dto';
import { OnboardingRepository } from './repositories/onboarding.repository';
import { EquipmentRepository } from '../equipment/repositories/equipment.repository';
import { RecommendationService } from '../recommendation/recommendation.service';
import { getMondayOfWeek } from '../plan/utils/date.utils';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly onboardingRepository: OnboardingRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly recommendationService: RecommendationService,
  ) {}

  async getProfile(userId: string): Promise<OnboardingProfileResponseDto> {
    const profile = await this.onboardingRepository.findByUserId(userId);
    if (!profile || !profile.completedAt) {
      throw new NotFoundException(
        'Onboarding profile not found or not completed',
      );
    }

    const equipmentIds =
      await this.equipmentRepository.getUserEquipmentPreferences(userId);

    return this.toResponseDto(profile, equipmentIds);
  }

  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<OnboardingProfileResponseDto> {
    // 1. Persist user equipment preferences in a database transaction
    await this.equipmentRepository.replaceUserEquipmentPreferences(
      userId,
      dto.equipmentIds,
    );

    // 2. Create or update user onboarding profile with completion timestamp
    const profile = await this.onboardingRepository.upsertProfile(userId, {
      goal: dto.goal,
      experienceLevel: dto.experienceLevel,
      workoutDaysPerWeek: dto.workoutDaysPerWeek,
      completedAt: new Date(),
    });

    // 3. Trigger initial plan generation for the current week
    const currentMonday = getMondayOfWeek(new Date());
    await this.recommendationService.generateWeeklyPlan(userId, currentMonday);

    return this.toResponseDto(profile, dto.equipmentIds);
  }

  private toResponseDto(
    profile: OnboardingProfile,
    equipmentIds?: string[],
  ): OnboardingProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      goal: profile.goal,
      experienceLevel: profile.experienceLevel,
      workoutDaysPerWeek: profile.workoutDaysPerWeek,
      completedAt: profile.completedAt
        ? profile.completedAt.toISOString()
        : null,
      equipmentIds,
    };
  }
}
