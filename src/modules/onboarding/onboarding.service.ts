import { Injectable, NotFoundException } from '@nestjs/common';
import { OnboardingProfile } from '@prisma/client';
import { CompleteOnboardingDto, OnboardingProfileResponseDto } from './dto';
import { OnboardingRepository } from './repositories/onboarding.repository';
import { EquipmentRepository } from '../equipment/repositories/equipment.repository';
import { RecommendationService } from '../recommendation/recommendation.service';
import { getMondayOfWeek } from '../plan/utils/date.utils';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly onboardingRepository: OnboardingRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly recommendationService: RecommendationService,
    private readonly prisma: PrismaService,
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
    const birthDate = dto.birthDate ? new Date(dto.birthDate) : undefined;

    // 1. Persist user equipment preferences in a database transaction
    await this.equipmentRepository.replaceUserEquipmentPreferences(
      userId,
      dto.equipmentIds,
    );

    // 2. Create or update user onboarding profile with completion timestamp & biometrics
    const profile = await this.onboardingRepository.upsertProfile(userId, {
      goal: dto.goal,
      experienceLevel: dto.experienceLevel,
      workoutDaysPerWeek: dto.workoutDaysPerWeek,
      completedAt: new Date(),
      gender: dto.gender,
      birthDate,
      heightCm: dto.heightCm,
      currentWeightKg: dto.currentWeightKg,
      targetWeightKg: dto.targetWeightKg,
    });

    // 3. Update User biometrics and goalType
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        goalType: dto.goal,
        gender: dto.gender,
        birthDate,
        heightCm: dto.heightCm,
        targetWeightKg: dto.targetWeightKg,
      },
    });

    // 4. If current weight was provided, record initial weight entry
    if (dto.currentWeightKg) {
      await this.prisma.weightEntry.create({
        data: {
          userId,
          date: new Date(),
          weightKg: dto.currentWeightKg,
        },
      });

      if (dto.targetWeightKg) {
        await this.prisma.goal.create({
          data: {
            userId,
            type: dto.goal,
            targetValue: dto.targetWeightKg,
            currentValue: dto.currentWeightKg,
            deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    // 5. Trigger initial plan generation for the current week
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
