import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActivityDailySnapshot } from '@prisma/client';

export interface UpsertActivitySnapshotData {
  date: Date;
  steps: number;
  stepsGoal: number;
  caloriesActive: number;
  sleepHours: number;
  avgHeartRate?: number | null;
  distanceKm: number;
}

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    userId: string,
    data: UpsertActivitySnapshotData,
  ): Promise<ActivityDailySnapshot> {
    return this.prisma.activityDailySnapshot.upsert({
      where: {
        userId_date: {
          userId,
          date: data.date,
        },
      },
      update: {
        steps: data.steps,
        stepsGoal: data.stepsGoal,
        caloriesActive: data.caloriesActive,
        sleepHours: data.sleepHours,
        avgHeartRate: data.avgHeartRate ?? null,
        distanceKm: data.distanceKm,
      },
      create: {
        userId,
        date: data.date,
        steps: data.steps,
        stepsGoal: data.stepsGoal,
        caloriesActive: data.caloriesActive,
        sleepHours: data.sleepHours,
        avgHeartRate: data.avgHeartRate ?? null,
        distanceKm: data.distanceKm,
      },
    });
  }

  async upsertBatch(
    userId: string,
    snapshots: UpsertActivitySnapshotData[],
  ): Promise<ActivityDailySnapshot[]> {
    return this.prisma.$transaction(async (tx) => {
      const results: ActivityDailySnapshot[] = [];
      for (const snapshot of snapshots) {
        const entry = await tx.activityDailySnapshot.upsert({
          where: {
            userId_date: {
              userId,
              date: snapshot.date,
            },
          },
          update: {
            steps: snapshot.steps,
            stepsGoal: snapshot.stepsGoal,
            caloriesActive: snapshot.caloriesActive,
            sleepHours: snapshot.sleepHours,
            avgHeartRate: snapshot.avgHeartRate ?? null,
            distanceKm: snapshot.distanceKm,
          },
          create: {
            userId,
            date: snapshot.date,
            steps: snapshot.steps,
            stepsGoal: snapshot.stepsGoal,
            caloriesActive: snapshot.caloriesActive,
            sleepHours: snapshot.sleepHours,
            avgHeartRate: snapshot.avgHeartRate ?? null,
            distanceKm: snapshot.distanceKm,
          },
        });
        results.push(entry);
      }
      return results;
    });
  }

  async findByUserAndDateRange(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<ActivityDailySnapshot[]> {
    return this.prisma.activityDailySnapshot.findMany({
      where: {
        userId,
        date: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }
}
