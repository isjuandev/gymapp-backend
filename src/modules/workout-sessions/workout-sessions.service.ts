import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { WorkoutSessionsRepository } from './repositories/workout-sessions.repository';
import { WorkoutsRepository } from '../workouts/repositories/workouts.repository';
import { CreateWorkoutSessionDto } from './dto/create-workout-session.dto';
import { CompleteWorkoutSessionDto } from './dto/complete-workout-session.dto';
import { WorkoutSessionFilterDto } from './dto/workout-session-filter.dto';
import { WorkoutSessionResponseDto } from './dto/workout-session-response.dto';
import { CreateSetLogDto } from './dto/create-set-log.dto';
import { SetLogResponseDto } from './dto/set-log-response.dto';
import { ExerciseProgressResponseDto } from './dto/exercise-progress-response.dto';
import { WorkoutSessionStatus } from '@prisma/client';

@Injectable()
export class WorkoutSessionsService {
  constructor(
    private readonly workoutSessionsRepository: WorkoutSessionsRepository,
    private readonly workoutsRepository: WorkoutsRepository,
  ) {}

  /**
   * StartWorkoutSessionUseCase: Creates an in-progress workout session for the authenticated user.
   */
  async startSession(
    userId: string,
    dto: CreateWorkoutSessionDto,
  ): Promise<WorkoutSessionResponseDto> {
    const workout = await this.workoutsRepository.findById(dto.workoutId);
    if (!workout) {
      throw new NotFoundException(
        `Workout with ID '${dto.workoutId}' not found`,
      );
    }

    const session = await this.workoutSessionsRepository.create(
      userId,
      dto.workoutId,
      new Date(),
    );

    return WorkoutSessionResponseDto.fromEntity(session);
  }

  /**
   * CompleteWorkoutSessionUseCase: Validates ownership and IN_PROGRESS state, records metrics,
   * updates status to COMPLETED, evaluates progressive overload for completed sets, and synchronizes matching daily plan if active.
   */
  async completeSession(
    id: string,
    userId: string,
    dto: CompleteWorkoutSessionDto,
  ): Promise<WorkoutSessionResponseDto> {
    const session = await this.workoutSessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Workout session with ID '${id}' not found`);
    }

    // Strict ownership verification: cannot complete another user's session
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workout session',
      );
    }

    // Must be IN_PROGRESS to complete (reject with 409 if already COMPLETED or SKIPPED)
    if (session.status !== WorkoutSessionStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Cannot complete session: current status is '${session.status}'`,
      );
    }

    const completedSession =
      await this.workoutSessionsRepository.completeSession(id, dto);

    // Progressive Overload Engine: Evaluate Double Progression for all logged sets in this session
    await this.evaluateProgressiveOverload(id, userId);

    // If an associated PlanDay exists for this workout on this date, complete it
    await this.workoutSessionsRepository.updateMatchingPlanDayToCompleted(
      userId,
      session.workoutId,
      session.date,
    );

    return WorkoutSessionResponseDto.fromEntity(completedSession);
  }

  /**
   * Skip session: marks session as SKIPPED.
   */
  async skipSession(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionResponseDto> {
    const session = await this.workoutSessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Workout session with ID '${id}' not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workout session',
      );
    }

    if (session.status === WorkoutSessionStatus.COMPLETED) {
      throw new ConflictException(
        'Cannot skip an already completed workout session',
      );
    }

    const skippedSession = await this.workoutSessionsRepository.skipSession(id);
    return WorkoutSessionResponseDto.fromEntity(skippedSession);
  }

  /**
   * Session history for the authenticated user, optionally filtered by date range.
   */
  async getUserSessions(
    userId: string,
    filter?: WorkoutSessionFilterDto,
  ): Promise<WorkoutSessionResponseDto[]> {
    const from = filter?.from ? new Date(filter.from) : undefined;
    const to = filter?.to ? new Date(filter.to) : undefined;

    const sessions =
      await this.workoutSessionsRepository.findByUserAndDateRange(
        userId,
        from,
        to,
      );

    return sessions.map((s) => WorkoutSessionResponseDto.fromEntity(s));
  }

  /**
   * Retrieve single session with ownership verification.
   */
  async getSessionById(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionResponseDto> {
    const session = await this.workoutSessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Workout session with ID '${id}' not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this workout session',
      );
    }

    return WorkoutSessionResponseDto.fromEntity(session);
  }

  // ============================================================================
  // SET LOGS METHODS
  // ============================================================================

  /**
   * Record a completed set during an active (IN_PROGRESS) workout session.
   */
  async addSetLog(
    sessionId: string,
    userId: string,
    dto: CreateSetLogDto,
  ): Promise<SetLogResponseDto> {
    const session = await this.workoutSessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(
        `Workout session with ID '${sessionId}' not found`,
      );
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workout session',
      );
    }

    if (session.status !== WorkoutSessionStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Cannot log sets: session status is '${session.status}', must be IN_PROGRESS`,
      );
    }

    // Verify exercise exists
    const exercise = await this.workoutSessionsRepository.findExerciseWithDetails(
      dto.exerciseId,
    );
    if (!exercise) {
      throw new NotFoundException(
        `Exercise with ID '${dto.exerciseId}' not found`,
      );
    }

    // Verify exercise belongs to the workout being executed
    if (exercise.workoutId !== session.workoutId) {
      throw new BadRequestException(
        `Exercise '${exercise.name}' does not belong to the active workout session`,
      );
    }

    const setLog = await this.workoutSessionsRepository.createSetLog(
      sessionId,
      dto,
    );
    return SetLogResponseDto.fromEntity(setLog);
  }

  /**
   * Get all set logs recorded in a session.
   */
  async getSessionSets(
    sessionId: string,
    userId: string,
  ): Promise<SetLogResponseDto[]> {
    const session = await this.workoutSessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(
        `Workout session with ID '${sessionId}' not found`,
      );
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this workout session',
      );
    }

    const logs =
      await this.workoutSessionsRepository.findSetLogsBySessionId(sessionId);
    return logs.map((l) => SetLogResponseDto.fromEntity(l));
  }

  /**
   * Delete a previously recorded set log in an active session.
   */
  async deleteSetLog(
    sessionId: string,
    setId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const session = await this.workoutSessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(
        `Workout session with ID '${sessionId}' not found`,
      );
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workout session',
      );
    }

    if (session.status !== WorkoutSessionStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Cannot delete set: session status is '${session.status}', must be IN_PROGRESS`,
      );
    }

    const setLog = await this.workoutSessionsRepository.findSetLogById(setId);
    if (!setLog || setLog.workoutSessionId !== sessionId) {
      throw new NotFoundException(
        `Set log with ID '${setId}' not found in this session`,
      );
    }

    await this.workoutSessionsRepository.deleteSetLog(setId);
    return { message: 'Set log deleted successfully' };
  }

  // ============================================================================
  // PROGRESSIVE OVERLOAD ENGINE
  // ============================================================================

  /**
   * Evaluates Double Progression for all working sets logged in a completed session:
   * 1. Groups working sets (non-warmup) by exerciseId.
   * 2. If all sets hit >= maxReps at the same working weight:
   *    - If previous session also hit target at this weight: consecutive = previous + 1.
   *    - If consecutive >= 2: weight is MASTERED -> calculates suggestedNextWeightKg = weight + incrementKg.
   *    - Else: consecutive = 1, suggestedNextWeightKg = null.
   * 3. Else: resets consecutive = 0, suggestedNextWeightKg = null.
   */
  private async evaluateProgressiveOverload(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const logs =
      await this.workoutSessionsRepository.findSetLogsBySessionId(sessionId);
    const workingLogs = logs.filter((log) => !log.isWarmup);
    if (workingLogs.length === 0) return;

    // Group logs by exerciseId
    const logsByExercise = new Map<string, typeof workingLogs>();
    for (const log of workingLogs) {
      const existing = logsByExercise.get(log.exerciseId) || [];
      existing.push(log);
      logsByExercise.set(log.exerciseId, existing);
    }

    for (const [exerciseId, exerciseSets] of logsByExercise.entries()) {
      const exercise =
        await this.workoutSessionsRepository.findExerciseWithDetails(exerciseId);
      if (!exercise) continue;

      const equipment =
        exercise.requiredEquipment ?? exercise.catalogItem?.equipment;
      const incrementKg = equipment?.incrementKg
        ? Number(equipment.incrementKg)
        : 2.5;
      const maxWeightKg = equipment?.maxWeightKg
        ? Number(equipment.maxWeightKg)
        : null;
      const targetReps = exercise.maxReps || 12;

      // Check if all working sets hit the top of the rep range
      const allHitTarget =
        exerciseSets.length >= 1 &&
        exerciseSets.every((s) => s.reps >= targetReps);

      // Representative working weight
      const sessionWorkingWeight = Math.min(
        ...exerciseSets.map((s) => Number(s.weightKg)),
      );

      const existingProgress =
        await this.workoutSessionsRepository.findProgressState(
          userId,
          exerciseId,
        );

      if (allHitTarget) {
        let consecutive = 1;
        if (
          existingProgress &&
          Number(existingProgress.currentWorkingWeightKg) ===
            sessionWorkingWeight
        ) {
          consecutive = existingProgress.consecutiveSessionsAtTarget + 1;
        }

        let suggestedNextWeight: number | null = null;
        if (consecutive >= 2) {
          suggestedNextWeight = sessionWorkingWeight + incrementKg;
          if (maxWeightKg !== null && suggestedNextWeight > maxWeightKg) {
            suggestedNextWeight = maxWeightKg;
          }
        }

        await this.workoutSessionsRepository.upsertProgressState(
          userId,
          exerciseId,
          {
            currentWorkingWeightKg: sessionWorkingWeight,
            consecutiveSessionsAtTarget: consecutive,
            suggestedNextWeightKg: suggestedNextWeight,
            lastSessionDate: new Date(),
          },
        );
      } else {
        const highestWeight = Math.max(
          ...exerciseSets.map((s) => Number(s.weightKg)),
        );
        await this.workoutSessionsRepository.upsertProgressState(
          userId,
          exerciseId,
          {
            currentWorkingWeightKg: highestWeight,
            consecutiveSessionsAtTarget: 0,
            suggestedNextWeightKg: null,
            lastSessionDate: new Date(),
          },
        );
      }
    }
  }

  /**
   * Get progress state & suggested next weight for an exercise for the authenticated user.
   */
  async getExerciseProgress(
    userId: string,
    exerciseId: string,
  ): Promise<ExerciseProgressResponseDto> {
    const exercise =
      await this.workoutSessionsRepository.findExerciseWithDetails(exerciseId);
    if (!exercise) {
      throw new NotFoundException(
        `Exercise with ID '${exerciseId}' not found`,
      );
    }

    const equipment =
      exercise.requiredEquipment ?? exercise.catalogItem?.equipment;
    const incrementKg = equipment?.incrementKg
      ? Number(equipment.incrementKg)
      : 2.5;

    const progress = await this.workoutSessionsRepository.findProgressState(
      userId,
      exerciseId,
    );

    const consecutive = progress?.consecutiveSessionsAtTarget ?? 0;
    const currentWeight = progress
      ? Number(progress.currentWorkingWeightKg)
      : 0;
    const suggestedWeight =
      progress?.suggestedNextWeightKg !== null &&
      progress?.suggestedNextWeightKg !== undefined
        ? Number(progress.suggestedNextWeightKg)
        : null;

    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      currentWorkingWeightKg: currentWeight,
      consecutiveSessionsAtTarget: consecutive,
      isMastered: consecutive >= 2,
      suggestedNextWeightKg: suggestedWeight,
      targetMinReps: exercise.minReps,
      targetMaxReps: exercise.maxReps,
      incrementKg,
      equipmentName: equipment?.name ?? null,
      lastSessionDate: progress?.lastSessionDate ?? null,
    };
  }

  /**
   * Get all exercise progress states for the authenticated user.
   */
  async getUserAllProgress(
    userId: string,
  ): Promise<ExerciseProgressResponseDto[]> {
    const states =
      await this.workoutSessionsRepository.findAllProgressStatesForUser(userId);

    return states.map((state) => {
      const exercise = state.exercise;
      const equipment =
        exercise.requiredEquipment ?? exercise.catalogItem?.equipment;
      const incrementKg = equipment?.incrementKg
        ? Number(equipment.incrementKg)
        : 2.5;
      const consecutive = state.consecutiveSessionsAtTarget;

      return {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        currentWorkingWeightKg: Number(state.currentWorkingWeightKg),
        consecutiveSessionsAtTarget: consecutive,
        isMastered: consecutive >= 2,
        suggestedNextWeightKg:
          state.suggestedNextWeightKg !== null
            ? Number(state.suggestedNextWeightKg)
            : null,
        targetMinReps: exercise.minReps,
        targetMaxReps: exercise.maxReps,
        incrementKg,
        equipmentName: equipment?.name ?? null,
        lastSessionDate: state.lastSessionDate,
      };
    });
  }

  /**
   * Get exercise history table and PR for a specific exercise and authenticated user.
   */
  async getExerciseHistory(
    userId: string,
    exerciseId: string,
  ): Promise<any> {
    const exercise =
      await this.workoutSessionsRepository.findExerciseWithDetails(exerciseId);
    if (!exercise) {
      throw new NotFoundException(
        `Exercise with ID '${exerciseId}' not found`,
      );
    }

    const progress = await this.workoutSessionsRepository.findProgressState(
      userId,
      exerciseId,
    );

    const logs =
      await this.workoutSessionsRepository.findExerciseSessionHistory(
        userId,
        exerciseId,
      );

    // Group logs by workoutSessionId
    const sessionsMap = new Map<string, typeof logs>();
    for (const log of logs) {
      const existing = sessionsMap.get(log.workoutSessionId) || [];
      existing.push(log);
      sessionsMap.set(log.workoutSessionId, existing);
    }

    const historyItems: {
      date: string;
      bestWeightKg: number;
      bestReps: number;
      isPR: boolean;
      estimated1RM: number;
      totalSets: number;
    }[] = [];

    let overallMax1RM = 0;
    let overallBestSet: {
      weightKg: number;
      reps: number;
      date: string;
      estimated1RM: number;
    } | null = null;

    for (const [, sessionLogs] of sessionsMap.entries()) {
      if (sessionLogs.length === 0) continue;

      // Sort sets in this session to find the best set by weight then reps
      const sortedSets = [...sessionLogs].sort((a, b) => {
        if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
        return b.reps - a.reps;
      });

      const best = sortedSets[0];
      const est1RM =
        Math.round(best.weightKg * (1 + best.reps / 30) * 10) / 10;
      const dateStr = best.completedAt.toISOString().split('T')[0];

      if (est1RM > overallMax1RM) {
        overallMax1RM = est1RM;
        overallBestSet = {
          weightKg: best.weightKg,
          reps: best.reps,
          date: dateStr,
          estimated1RM: est1RM,
        };
      }

      historyItems.push({
        date: dateStr,
        bestWeightKg: best.weightKg,
        bestReps: best.reps,
        isPR: false, // Flagged below
        estimated1RM: est1RM,
        totalSets: sessionLogs.length,
      });
    }

    // Flag the PR session(s)
    if (overallBestSet) {
      for (const item of historyItems) {
        if (item.estimated1RM === overallMax1RM) {
          item.isPR = true;
        }
      }
    }

    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      userNotes: progress?.notes ?? null,
      personalRecord: overallBestSet,
      history: historyItems,
    };
  }

  /**
   * Update personal notes for an exercise.
   */
  async updateExerciseNotes(
    userId: string,
    exerciseId: string,
    notes: string,
  ): Promise<{ message: string; notes: string }> {
    const exercise =
      await this.workoutSessionsRepository.findExerciseWithDetails(exerciseId);
    if (!exercise) {
      throw new NotFoundException(
        `Exercise with ID '${exerciseId}' not found`,
      );
    }

    const updated = await this.workoutSessionsRepository.updateExerciseNotes(
      userId,
      exerciseId,
      notes,
    );

    return {
      message: 'Exercise notes updated successfully',
      notes: updated.notes ?? '',
    };
  }
}
