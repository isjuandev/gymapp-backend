import { Injectable } from '@nestjs/common';
import { ActivityDailySnapshot } from '@prisma/client';
import {
  ActivityDailySnapshotResponseDto,
  ActivitySnapshotQueryDto,
  CreateActivityDailySnapshotDto,
} from './dto';
import { ActivityRepository } from './repositories/activity.repository';

@Injectable()
export class ActivityService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  /**
   * HealthKit on device is source of truth.
   * This endpoint stores daily snapshot backup for multi-device sync.
   * Upserts on (userId, date) - one snapshot per user per calendar day.
   */
  async createSnapshot(
    userId: string,
    dto: CreateActivityDailySnapshotDto,
  ): Promise<ActivityDailySnapshotResponseDto> {
    const rawDate = new Date(dto.date);
    const normalizedDate = new Date(
      Date.UTC(
        rawDate.getUTCFullYear(),
        rawDate.getUTCMonth(),
        rawDate.getUTCDate(),
      ),
    );

    const snapshot = await this.activityRepository.upsert(userId, {
      date: normalizedDate,
      steps: dto.steps,
      stepsGoal: dto.stepsGoal,
      caloriesActive: dto.caloriesActive,
      sleepHours: dto.sleepHours,
      avgHeartRate: dto.avgHeartRate ?? null,
      distanceKm: dto.distanceKm,
    });

    return this.toResponseDto(snapshot);
  }

  /**
   * Batch upsert for offline sync or historical backups.
   * Executes as an atomic transaction: all or nothing.
   */
  async createSnapshotsBatch(
    userId: string,
    dtos: CreateActivityDailySnapshotDto[],
  ): Promise<ActivityDailySnapshotResponseDto[]> {
    const snapshotsData = dtos.map((dto) => {
      const rawDate = new Date(dto.date);
      const normalizedDate = new Date(
        Date.UTC(
          rawDate.getUTCFullYear(),
          rawDate.getUTCMonth(),
          rawDate.getUTCDate(),
        ),
      );
      return {
        date: normalizedDate,
        steps: dto.steps,
        stepsGoal: dto.stepsGoal,
        caloriesActive: dto.caloriesActive,
        sleepHours: dto.sleepHours,
        avgHeartRate: dto.avgHeartRate ?? null,
        distanceKm: dto.distanceKm,
      };
    });

    const snapshots = await this.activityRepository.upsertBatch(
      userId,
      snapshotsData,
    );

    return snapshots.map((s) => this.toResponseDto(s));
  }

  /**
   * Returns snapshots in date range [from, to] for device restore / multi-device fallback.
   */
  async getSnapshots(
    userId: string,
    query?: ActivitySnapshotQueryDto,
  ): Promise<ActivityDailySnapshotResponseDto[]> {
    let fromDate: Date | undefined;
    if (query?.from) {
      const f = new Date(query.from);
      fromDate = new Date(
        Date.UTC(
          f.getUTCFullYear(),
          f.getUTCMonth(),
          f.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      );
    }

    let toDate: Date | undefined;
    if (query?.to) {
      const t = new Date(query.to);
      toDate = new Date(
        Date.UTC(
          t.getUTCFullYear(),
          t.getUTCMonth(),
          t.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );
    }

    const snapshots = await this.activityRepository.findByUserAndDateRange(
      userId,
      fromDate,
      toDate,
    );

    return snapshots.map((s) => this.toResponseDto(s));
  }

  private toResponseDto(
    entity: ActivityDailySnapshot,
  ): ActivityDailySnapshotResponseDto {
    return {
      id: entity.id,
      userId: entity.userId,
      date: entity.date.toISOString(),
      steps: entity.steps,
      stepsGoal: entity.stepsGoal,
      caloriesActive: entity.caloriesActive,
      sleepHours: entity.sleepHours,
      avgHeartRate: entity.avgHeartRate,
      distanceKm: entity.distanceKm,
    };
  }
}
