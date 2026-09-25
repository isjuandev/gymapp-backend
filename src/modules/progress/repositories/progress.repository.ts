import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Goal,
  GoalType,
  WeightEntry,
  WorkoutSessionStatus,
} from '@prisma/client';

export interface CreateGoalData {
  type: GoalType;
  targetValue: number;
  currentValue: number;
  deadline?: Date | null;
}

export interface UpdateGoalData {
  targetValue?: number;
  currentValue?: number;
  deadline?: Date | null;
}

export interface ProgressStatsData {
  workoutsThisMonth: number;
  activeTimeThisMonth: number;
}

@Injectable()
export class ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertWeightEntryWithGoalUpdate(
    userId: string,
    date: Date,
    weightKg: number,
  ): Promise<WeightEntry> {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.weightEntry.upsert({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
        update: {
          weightKg,
        },
        create: {
          userId,
          date,
          weightKg,
        },
      });

      // Find active goal: latest non-expired goal, or latest created goal
      const now = new Date();
      const activeGoal = await tx.goal.findFirst({
        where: {
          userId,
          OR: [{ deadline: null }, { deadline: { gte: now } }],
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const targetGoal =
        activeGoal ??
        (await tx.goal.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }));

      // If the active goal is LOSE_WEIGHT, update currentValue to the new weightKg
      if (targetGoal && targetGoal.type === GoalType.LOSE_WEIGHT) {
        await tx.goal.update({
          where: { id: targetGoal.id },
          data: { currentValue: weightKg },
        });
      }

      return entry;
    });
  }

  async findWeightEntriesByRange(
    userId: string,
    fromDate: Date,
  ): Promise<WeightEntry[]> {
    return this.prisma.weightEntry.findMany({
      where: {
        userId,
        date: {
          gte: fromDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async findActiveGoal(userId: string): Promise<Goal | null> {
    const now = new Date();
    const activeGoal = await this.prisma.goal.findFirst({
      where: {
        userId,
        OR: [{ deadline: null }, { deadline: { gte: now } }],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeGoal) {
      return activeGoal;
    }

    // Fallback: return newest created goal if none unexpired
    return this.prisma.goal.findFirst({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findGoalById(id: string): Promise<Goal | null> {
    return this.prisma.goal.findUnique({
      where: { id },
    });
  }

  async createGoal(userId: string, data: CreateGoalData): Promise<Goal> {
    return this.prisma.goal.create({
      data: {
        userId,
        type: data.type,
        targetValue: data.targetValue,
        currentValue: data.currentValue,
        deadline: data.deadline,
      },
    });
  }

  async updateGoal(id: string, data: UpdateGoalData): Promise<Goal> {
    return this.prisma.goal.update({
      where: { id },
      data: {
        ...(data.targetValue !== undefined
          ? { targetValue: data.targetValue }
          : {}),
        ...(data.currentValue !== undefined
          ? { currentValue: data.currentValue }
          : {}),
        ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
      },
    });
  }

  async getMonthWorkoutStats(
    userId: string,
    startOfMonth: Date,
    endOfMonth: Date,
  ): Promise<ProgressStatsData> {
    const completedSessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        status: WorkoutSessionStatus.COMPLETED,
        date: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      select: {
        durationActualSeconds: true,
      },
    });

    const workoutsThisMonth = completedSessions.length;
    const activeTimeThisMonth = completedSessions.reduce(
      (sum, session) => sum + (session.durationActualSeconds ?? 0),
      0,
    );

    return {
      workoutsThisMonth,
      activeTimeThisMonth,
    };
  }
}
