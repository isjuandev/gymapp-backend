import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Equipment,
  Exercise,
  ExerciseCatalog,
  ExerciseProgressState,
  ExerciseSetLog,
  PlanDayStatus,
  Prisma,
  Workout,
  WorkoutSession,
  WorkoutSessionStatus,
} from '@prisma/client';
import { CreateSetLogDto } from '../dto/create-set-log.dto';

export interface CompleteSessionData {
  durationActualSeconds?: number | null;
  kcalBurned?: number | null;
  avgHeartRate?: number | null;
}

/**
 * Database client usable inside or outside a transaction (Fase 2: the
 * complete-session flow runs all its writes on one interactive transaction).
 * PrismaService extends PrismaClient, so both expose the same delegates.
 */
export type SessionDbClient = Prisma.TransactionClient | PrismaService;

export type ExerciseWithEquipmentDetails = Exercise & {
  requiredEquipment: Equipment | null;
  catalogItem: (ExerciseCatalog & { equipment: Equipment | null }) | null;
};

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
    db: SessionDbClient = this.prisma,
  ): Promise<(WorkoutSession & { workout: Workout | null }) | null> {
    return db.workoutSession.findUnique({
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
    db: SessionDbClient = this.prisma,
  ): Promise<WorkoutSession & { workout: Workout | null }> {
    return db.workoutSession.update({
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
    db: SessionDbClient = this.prisma,
  ): Promise<void> {
    const startOfDay = new Date(sessionDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(sessionDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const matchingPlanDay = await db.planDay.findFirst({
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
      await db.planDay.update({
        where: { id: matchingPlanDay.id },
        data: {
          status: PlanDayStatus.COMPLETED,
        },
      });
    }
  }

  // ============================================================================
  // SET LOGS METHODS
  // ============================================================================

  async createSetLog(
    sessionId: string,
    dto: CreateSetLogDto,
  ): Promise<ExerciseSetLog> {
    return this.prisma.exerciseSetLog.create({
      data: {
        workoutSessionId: sessionId,
        exerciseId: dto.exerciseId,
        setNumber: dto.setNumber,
        weightKg: dto.weightKg,
        reps: dto.reps,
        isWarmup: dto.isWarmup ?? false,
        rpe: dto.rpe ?? null,
      },
    });
  }

  async createBatchSetLogs(
    sessionId: string,
    dtos: CreateSetLogDto[],
  ): Promise<ExerciseSetLog[]> {
    return this.prisma.$transaction(async (tx) => {
      const createdLogs: ExerciseSetLog[] = [];
      for (const dto of dtos) {
        const item = await tx.exerciseSetLog.create({
          data: {
            workoutSessionId: sessionId,
            exerciseId: dto.exerciseId,
            setNumber: dto.setNumber,
            weightKg: dto.weightKg,
            reps: dto.reps,
            isWarmup: dto.isWarmup ?? false,
            rpe: dto.rpe ?? null,
          },
        });
        createdLogs.push(item);
      }
      return createdLogs;
    });
  }

  async findSetLogsBySessionId(
    sessionId: string,
    db: SessionDbClient = this.prisma,
  ): Promise<ExerciseSetLog[]> {
    return db.exerciseSetLog.findMany({
      where: { workoutSessionId: sessionId },
      orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
    });
  }

  async findSetLogById(setId: string): Promise<ExerciseSetLog | null> {
    return this.prisma.exerciseSetLog.findUnique({
      where: { id: setId },
    });
  }

  async deleteSetLog(setId: string): Promise<ExerciseSetLog> {
    return this.prisma.exerciseSetLog.delete({
      where: { id: setId },
    });
  }

  // ============================================================================
  // EXERCISE & PROGRESS METHODS
  // ============================================================================

  async findExerciseWithDetails(
    exerciseId: string,
    db: SessionDbClient = this.prisma,
  ): Promise<ExerciseWithEquipmentDetails | null> {
    return db.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        requiredEquipment: true,
        catalogItem: {
          include: {
            equipment: true,
          },
        },
      },
    });
  }

  async findExerciseInWorkout(
    workoutId: string,
    exerciseId: string,
    db: SessionDbClient = this.prisma,
  ): Promise<ExerciseWithEquipmentDetails | null> {
    const exercise = await this.findExerciseWithDetails(exerciseId, db);
    if (exercise && exercise.workoutId === workoutId) {
      return exercise;
    }

    return db.exercise.findFirst({
      where: {
        workoutId,
        OR: [
          { id: exerciseId },
          { catalogId: exerciseId },
          { substitutionGroupId: exerciseId },
        ],
      },
      include: {
        requiredEquipment: true,
        catalogItem: {
          include: {
            equipment: true,
          },
        },
      },
    });
  }

  async findProgressState(
    userId: string,
    exerciseId: string,
    db: SessionDbClient = this.prisma,
  ): Promise<ExerciseProgressState | null> {
    return db.exerciseProgressState.findUnique({
      where: {
        userId_exerciseId: {
          userId,
          exerciseId,
        },
      },
    });
  }

  async findAllProgressStatesForUser(userId: string) {
    return this.prisma.exerciseProgressState.findMany({
      where: { userId },
      include: {
        exercise: {
          include: {
            requiredEquipment: true,
            catalogItem: {
              include: {
                equipment: true,
              },
            },
          },
        },
      },
      orderBy: { lastUpdated: 'desc' },
    });
  }

  async upsertProgressState(
    userId: string,
    exerciseId: string,
    data: {
      currentWorkingWeightKg: number;
      consecutiveSessionsAtTarget: number;
      suggestedNextWeightKg: number | null;
      lastSessionDate: Date;
    },
    db: SessionDbClient = this.prisma,
  ): Promise<ExerciseProgressState> {
    return db.exerciseProgressState.upsert({
      where: {
        userId_exerciseId: {
          userId,
          exerciseId,
        },
      },
      create: {
        userId,
        exerciseId,
        currentWorkingWeightKg: data.currentWorkingWeightKg,
        consecutiveSessionsAtTarget: data.consecutiveSessionsAtTarget,
        suggestedNextWeightKg: data.suggestedNextWeightKg,
        lastSessionDate: data.lastSessionDate,
      },
      update: {
        currentWorkingWeightKg: data.currentWorkingWeightKg,
        consecutiveSessionsAtTarget: data.consecutiveSessionsAtTarget,
        suggestedNextWeightKg: data.suggestedNextWeightKg,
        lastSessionDate: data.lastSessionDate,
      },
    });
  }

  async findExerciseSessionHistory(userId: string, exerciseId: string) {
    return this.prisma.exerciseSetLog.findMany({
      where: {
        exerciseId,
        workoutSession: { userId },
        isWarmup: false,
      },
      include: {
        workoutSession: true,
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async updateExerciseNotes(
    userId: string,
    exerciseId: string,
    notes: string,
  ): Promise<ExerciseProgressState> {
    return this.prisma.exerciseProgressState.upsert({
      where: {
        userId_exerciseId: {
          userId,
          exerciseId,
        },
      },
      create: {
        userId,
        exerciseId,
        currentWorkingWeightKg: 0,
        consecutiveSessionsAtTarget: 0,
        notes,
      },
      update: {
        notes,
      },
    });
  }
}
