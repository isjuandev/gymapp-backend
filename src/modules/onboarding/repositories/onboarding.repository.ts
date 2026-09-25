import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExperienceLevel, GoalType, OnboardingProfile } from '@prisma/client';

export interface UpsertOnboardingData {
  goal: GoalType;
  experienceLevel: ExperienceLevel;
  workoutDaysPerWeek: number;
  completedAt: Date;
}

@Injectable()
export class OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<OnboardingProfile | null> {
    return this.prisma.onboardingProfile.findUnique({
      where: { userId },
    });
  }

  async upsertProfile(
    userId: string,
    data: UpsertOnboardingData,
  ): Promise<OnboardingProfile> {
    return this.prisma.onboardingProfile.upsert({
      where: { userId },
      update: {
        goal: data.goal,
        experienceLevel: data.experienceLevel,
        workoutDaysPerWeek: data.workoutDaysPerWeek,
        completedAt: data.completedAt,
      },
      create: {
        userId,
        goal: data.goal,
        experienceLevel: data.experienceLevel,
        workoutDaysPerWeek: data.workoutDaysPerWeek,
        completedAt: data.completedAt,
      },
    });
  }
}
