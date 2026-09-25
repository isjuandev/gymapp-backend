import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PlanDayStatus,
  Workout,
  WorkoutSession,
  WorkoutSessionStatus,
} from '@prisma/client';

export interface CompleteSessionData {
  durationActualSeconds: number;
  kcalBurned: number;
  avgHeartRate?: number;
}

@Injectable()
export class WorkoutSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    workoutId: string,
    date: Date = new Date(),
  ): Promise<WorkoutSession & { workout: Workout | null }> {
    return this.prisma.workoutSession.create({
      data: {
        userId,
        workoutId,
        date,
        status: WorkoutSessionStatus.IN_PROGRESS,
      },
      include: {
        workout: true,
      },
    });
  }

  async findById(
    id: string,
  ): Promise<(WorkoutSession & { workout: Workout | null }) | null> {
    return this.prisma.workoutSession.findUnique({
      where: { id },
      include: {
        workout: true,
      },
    });
  }

  async findByUserAndDateRange(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<(WorkoutSession & { workout: Workout | null })[]> {
    return this.prisma.workoutSession.findMany({
      where: {
        userId,
        date: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      include: {
        workout: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async completeSession(
    id: string,
    data: CompleteSessionData,
  ): Promise<WorkoutSession & { workout: Workout | null }> {
    return this.prisma.workoutSession.update({
      where: { id },
      data: {
        status: WorkoutSessionStatus.COMPLETED,
        durationActualSeconds: data.durationActualSeconds,
        kcalBurned: data.kcalBurned,
        avgHeartRate: data.avgHeartRate ?? null,
      },
      include: {
        workout: true,
      },
    });
  }

  async skipSession(
    id: string,
  ): Promise<WorkoutSession & { workout: Workout | null }> {
    return this.prisma.workoutSession.update({
      where: { id },
      data: {
        status: WorkoutSessionStatus.SKIPPED,
      },
      include: {
        workout: true,
      },
    });
  }

  async updateMatchingPlanDayToCompleted(
    userId: string,
    workoutId: string,
    sessionDate: Date,
  ): Promise<void> {
    const startOfDay = new Date(sessionDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(sessionDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const matchingPlanDay = await this.prisma.planDay.findFirst({
      where: {
        workoutId,
        weeklyPlan: {
          userId,
        },
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: PlanDayStatus.COMPLETED,
        },
      },
    });

    if (matchingPlanDay) {
      await this.prisma.planDay.update({
        where: { id: matchingPlanDay.id },
        data: {
          status: PlanDayStatus.COMPLETED,
        },
      });
    }
  }
}
