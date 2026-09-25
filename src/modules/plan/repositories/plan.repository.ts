import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlanDay, PlanDayStatus, WeeklyPlan, Workout } from '@prisma/client';
import { UpdatePlanDayDto } from '../dto/update-plan-day.dto';

export type WeeklyPlanWithDaysAndWorkout = WeeklyPlan & {
  days: (PlanDay & { workout: Workout | null })[];
};

export type PlanDayWithPlanAndWorkout = PlanDay & {
  weeklyPlan: WeeklyPlan;
  workout: Workout | null;
};

export interface PlanDayCreationData {
  date: Date;
  workoutId: string | null;
  isRestDay: boolean;
  status: PlanDayStatus;
}

@Injectable()
export class PlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWeeklyPlanByWeek(
    userId: string,
    weekStartDate: Date,
  ): Promise<WeeklyPlanWithDaysAndWorkout | null> {
    return this.prisma.weeklyPlan.findFirst({
      where: {
        userId,
        weekStartDate,
      },
      include: {
        days: {
          include: {
            workout: true,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });
  }

  async findLatestWeeklyPlanBefore(
    userId: string,
    beforeDate: Date,
  ): Promise<WeeklyPlanWithDaysAndWorkout | null> {
    return this.prisma.weeklyPlan.findFirst({
      where: {
        userId,
        weekStartDate: {
          lt: beforeDate,
        },
      },
      orderBy: {
        weekStartDate: 'desc',
      },
      include: {
        days: {
          include: {
            workout: true,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });
  }

  async createWeeklyPlanWithDays(
    userId: string,
    weekStartDate: Date,
    daysData: PlanDayCreationData[],
  ): Promise<WeeklyPlanWithDaysAndWorkout> {
    return this.prisma.weeklyPlan.create({
      data: {
        userId,
        weekStartDate,
        days: {
          create: daysData.map((d) => ({
            date: d.date,
            workoutId: d.workoutId,
            isRestDay: d.isRestDay,
            status: d.status,
          })),
        },
      },
      include: {
        days: {
          include: {
            workout: true,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });
  }

  async findPlanDayById(
    planDayId: string,
  ): Promise<PlanDayWithPlanAndWorkout | null> {
    return this.prisma.planDay.findUnique({
      where: { id: planDayId },
      include: {
        weeklyPlan: true,
        workout: true,
      },
    });
  }

  async updatePlanDay(
    planDayId: string,
    data: UpdatePlanDayDto,
  ): Promise<PlanDay & { workout: Workout | null }> {
    return this.prisma.planDay.update({
      where: { id: planDayId },
      data: {
        ...(data.workoutId !== undefined ? { workoutId: data.workoutId } : {}),
        ...(data.isRestDay !== undefined ? { isRestDay: data.isRestDay } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: {
        workout: true,
      },
    });
  }
}
