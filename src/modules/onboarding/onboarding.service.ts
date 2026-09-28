import { Injectable, NotFoundException } from '@nestjs/common';
import { OnboardingProfile } from '@prisma/client';
import { CompleteOnboardingDto, OnboardingProfileResponseDto } from './dto';
import { OnboardingRepository } from './repositories/onboarding.repository';
import { EquipmentRepository } from '../equipment/repositories/equipment.repository';
import { PlanService } from '../plan/plan.service';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly onboardingRepository: OnboardingRepository,
    private readonly equipmentRepository: EquipmentRepository,
    private readonly planService: PlanService,
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

    // 4. If current weight was provided, record the initial weight entry
    // (idempotent per calendar day: re-submitting onboarding does not stack rows)
    // and ensure a goal row of this type exists (reused, never duplicated).
    if (dto.currentWeightKg) {
      const now = new Date();
      const startOfDay = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      );
      const endOfDay = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );
      const existingEntry = await this.prisma.weightEntry.findFirst({
        where: { userId, date: { gte: startOfDay, lte: endOfDay } },
      });
      if (!existingEntry) {
        await this.prisma.weightEntry.create({
          data: {
            userId,
            date: now,
            weightKg: dto.currentWeightKg,
          },
        });
      }

      if (dto.targetWeightKg) {
        const existingGoal = await this.prisma.goal.findFirst({
          where: { userId, type: dto.goal },
          orderBy: { createdAt: 'desc' },
        });
        if (!existingGoal) {
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
    }

    // 5. Assign the initial PRESET plan (canonical UserPlan + WeeklyPlan +
    //    single schedule rewrite + goal alignment, one transaction).
    await this.planService.assignPlan(userId);

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
