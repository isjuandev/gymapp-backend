import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { WorkoutSessionsService } from './workout-sessions.service';
import { WorkoutSessionsRepository } from './repositories/workout-sessions.repository';
import { WorkoutsRepository } from '../workouts/repositories/workouts.repository';
import { WorkoutSessionStatus } from '@prisma/client';

describe('WorkoutSessionsService', () => {
  let service: WorkoutSessionsService;
  let sessionsRepo: jest.Mocked<WorkoutSessionsRepository>;
  let workoutsRepo: jest.Mocked<WorkoutsRepository>;

  const userId = 'user-uuid-1111';
  const otherUserId = 'user-uuid-2222';
  const workoutId = 'workout-uuid-3333';
  const sessionId = 'session-uuid-4444';
  const exerciseId = 'exercise-uuid-5555';
  const setId = 'set-uuid-6666';

  const mockSession = {
    id: sessionId,
    userId,
    workoutId,
    date: new Date('2026-09-24T12:00:00.000Z'),
    status: WorkoutSessionStatus.IN_PROGRESS,
    durationActualSeconds: null,
    kcalBurned: null,
    avgHeartRate: null,
    workout: {
      id: workoutId,
      programId: 'program-uuid',
      title: 'Pecho Power',
      durationMinutes: 45,
      difficulty: 'Intermedio',
      kcalEstimate: 400,
      imageAssetName: 'img',
      rounds: 4,
    },
  };

  const mockExercise = {
    id: exerciseId,
    workoutId,
    name: 'Press de Banca Plano',
    order: 1,
    minReps: 8,
    maxReps: 12,
    defaultSets: 3,
    restSeconds: 90,
    requiredEquipment: {
      id: 'eq-bench',
      name: 'Banco Plano y Barra',
      incrementKg: 2.5,
      maxWeightKg: 200,
    },
    catalogItem: null,
  };

  beforeEach(async () => {
    const mockSessionsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserAndDateRange: jest.fn(),
      completeSession: jest.fn(),
      skipSession: jest.fn(),
      updateMatchingPlanDayToCompleted: jest.fn(),
      createSetLog: jest.fn(),
      findSetLogsBySessionId: jest.fn(),
      findSetLogById: jest.fn(),
      deleteSetLog: jest.fn(),
      findExerciseWithDetails: jest.fn(),
      findProgressState: jest.fn(),
      findAllProgressStatesForUser: jest.fn(),
      upsertProgressState: jest.fn(),
      findExerciseSessionHistory: jest.fn(),
      updateExerciseNotes: jest.fn(),
    };

    const mockWorkoutsRepo = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutSessionsService,
        { provide: WorkoutSessionsRepository, useValue: mockSessionsRepo },
        { provide: WorkoutsRepository, useValue: mockWorkoutsRepo },
      ],
    }).compile();

    service = module.get<WorkoutSessionsService>(WorkoutSessionsService);
    sessionsRepo = module.get(WorkoutSessionsRepository);
    workoutsRepo = module.get(WorkoutsRepository);
  });

  describe('startSession (StartWorkoutSessionUseCase)', () => {
    it('should create an IN_PROGRESS session for authenticated user', async () => {
      workoutsRepo.findById.mockResolvedValue(mockSession.workout as any);
      sessionsRepo.create.mockResolvedValue(mockSession as any);

      const result = await service.startSession(userId, { workoutId });

      expect(workoutsRepo.findById).toHaveBeenCalledWith(workoutId);
      expect(sessionsRepo.create).toHaveBeenCalledWith(
        userId,
        workoutId,
        expect.any(Date),
      );
      expect(result.id).toBe(sessionId);
      expect(result.status).toBe(WorkoutSessionStatus.IN_PROGRESS);
    });

    it('should throw NotFoundException if workout does not exist', async () => {
      workoutsRepo.findById.mockResolvedValue(null);

      await expect(
        service.startSession(userId, { workoutId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeSession (CompleteWorkoutSessionUseCase & Progressive Overload)', () => {
    it('should complete session, evaluate progressive overload and suggest next weight on 2nd consecutive session at target', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.completeSession.mockResolvedValue({
        ...mockSession,
        status: WorkoutSessionStatus.COMPLETED,
        durationActualSeconds: 2700,
        kcalBurned: 420,
        avgHeartRate: 135,
      } as any);

      // Mock 3 working sets hitting 12 reps at 40kg
      sessionsRepo.findSetLogsBySessionId.mockResolvedValue([
        {
          id: 'set-1',
          workoutSessionId: sessionId,
          exerciseId,
          setNumber: 1,
          weightKg: 40,
          reps: 12,
          isWarmup: false,
          rpe: 8,
          completedAt: new Date(),
        },
        {
          id: 'set-2',
          workoutSessionId: sessionId,
          exerciseId,
          setNumber: 2,
          weightKg: 40,
          reps: 12,
          isWarmup: false,
          rpe: 8.5,
          completedAt: new Date(),
        },
      ] as any);

      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);

      // Previous state: already completed 1 session at 40kg
      sessionsRepo.findProgressState.mockResolvedValue({
        id: 'prog-1',
        userId,
        exerciseId,
        currentWorkingWeightKg: 40,
        consecutiveSessionsAtTarget: 1,
        suggestedNextWeightKg: null,
        lastSessionDate: new Date(),
        lastUpdated: new Date(),
      } as any);

      const result = await service.completeSession(sessionId, userId, {
        durationActualSeconds: 2700,
        kcalBurned: 420,
        avgHeartRate: 135,
      });

      expect(sessionsRepo.completeSession).toHaveBeenCalledWith(sessionId, {
        durationActualSeconds: 2700,
        kcalBurned: 420,
        avgHeartRate: 135,
      });

      // Consecutive should now be 2, and suggested next weight should be 40 + 2.5 = 42.5kg!
      expect(sessionsRepo.upsertProgressState).toHaveBeenCalledWith(
        userId,
        exerciseId,
        expect.objectContaining({
          currentWorkingWeightKg: 40,
          consecutiveSessionsAtTarget: 2,
          suggestedNextWeightKg: 42.5,
        }),
      );

      expect(result.status).toBe(WorkoutSessionStatus.COMPLETED);
    });

    it('should throw ForbiddenException if user does not own the session', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);

      await expect(
        service.completeSession(sessionId, otherUserId, {
          durationActualSeconds: 2700,
          kcalBurned: 400,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException (409) if session is already COMPLETED', async () => {
      sessionsRepo.findById.mockResolvedValue({
        ...mockSession,
        status: WorkoutSessionStatus.COMPLETED,
      } as any);

      await expect(
        service.completeSession(sessionId, userId, {
          durationActualSeconds: 2700,
          kcalBurned: 400,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Set Logging & Tracking', () => {
    it('should log a completed set for an exercise in progress', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.createSetLog.mockResolvedValue({
        id: setId,
        workoutSessionId: sessionId,
        exerciseId,
        setNumber: 1,
        weightKg: 40,
        reps: 12,
        isWarmup: false,
        rpe: 8,
        completedAt: new Date(),
      } as any);

      const result = await service.addSetLog(sessionId, userId, {
        exerciseId,
        setNumber: 1,
        weightKg: 40,
        reps: 12,
        isWarmup: false,
        rpe: 8,
      });

      expect(result.id).toBe(setId);
      expect(result.weightKg).toBe(40);
      expect(result.reps).toBe(12);
    });

    it('should reject set log if exercise does not belong to workout', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findExerciseWithDetails.mockResolvedValue({
        ...mockExercise,
        workoutId: 'different-workout-uuid',
      } as any);

      await expect(
        service.addSetLog(sessionId, userId, {
          exerciseId,
          setNumber: 1,
          weightKg: 40,
          reps: 12,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should retrieve all sets logged for a session', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findSetLogsBySessionId.mockResolvedValue([
        {
          id: setId,
          workoutSessionId: sessionId,
          exerciseId,
          setNumber: 1,
          weightKg: 40,
          reps: 12,
          isWarmup: false,
          rpe: 8,
          completedAt: new Date(),
        } as any,
      ]);

      const sets = await service.getSessionSets(sessionId, userId);
      expect(sets).toHaveLength(1);
      expect(sets[0].setNumber).toBe(1);
    });

    it('should delete a set log from an in-progress session', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findSetLogById.mockResolvedValue({
        id: setId,
        workoutSessionId: sessionId,
      } as any);

      const result = await service.deleteSetLog(sessionId, setId, userId);
      expect(sessionsRepo.deleteSetLog).toHaveBeenCalledWith(setId);
      expect(result.message).toContain('deleted successfully');
    });
  });

  describe('getExerciseProgress', () => {
    it('should return progressive overload status and mastery badge', async () => {
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.findProgressState.mockResolvedValue({
        id: 'prog-1',
        userId,
        exerciseId,
        currentWorkingWeightKg: 40,
        consecutiveSessionsAtTarget: 2,
        suggestedNextWeightKg: 42.5,
        lastSessionDate: new Date(),
        lastUpdated: new Date(),
      } as any);

      const progress = await service.getExerciseProgress(userId, exerciseId);

      expect(progress.exerciseId).toBe(exerciseId);
      expect(progress.currentWorkingWeightKg).toBe(40);
      expect(progress.isMastered).toBe(true);
      expect(progress.suggestedNextWeightKg).toBe(42.5);
      expect(progress.incrementKg).toBe(2.5);
    });
  });

  describe('getExerciseHistory', () => {
    it('should return session history, identify PR and user notes', async () => {
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.findProgressState.mockResolvedValue({
        id: 'prog-1',
        userId,
        exerciseId,
        currentWorkingWeightKg: 40,
        notes: 'Ajustar banco a 30 grados',
      } as any);
      sessionsRepo.findExerciseSessionHistory.mockResolvedValue([
        {
          id: 'log-1',
          workoutSessionId: 'session-1',
          exerciseId,
          setNumber: 1,
          weightKg: 40,
          reps: 10,
          isWarmup: false,
          completedAt: new Date('2026-09-20T10:00:00Z'),
        },
        {
          id: 'log-2',
          workoutSessionId: 'session-2',
          exerciseId,
          setNumber: 1,
          weightKg: 45,
          reps: 8,
          isWarmup: false,
          completedAt: new Date('2026-09-25T10:00:00Z'),
        },
      ] as any);

      const history = await service.getExerciseHistory(userId, exerciseId);

      expect(history.exerciseId).toBe(exerciseId);
      expect(history.userNotes).toBe('Ajustar banco a 30 grados');
      expect(history.personalRecord).not.toBeNull();
      expect(history.personalRecord?.weightKg).toBe(45);
      expect(history.personalRecord?.reps).toBe(8);
      expect(history.history).toHaveLength(2);
      expect(history.history.find((h: any) => h.bestWeightKg === 45)?.isPR).toBe(true);
    });
  });

  describe('updateExerciseNotes', () => {
    it('should save notes to exercise progress state', async () => {
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.updateExerciseNotes.mockResolvedValue({
        id: 'prog-1',
        userId,
        exerciseId,
        notes: 'Nueva técnica probada',
      } as any);

      const result = await service.updateExerciseNotes(userId, exerciseId, 'Nueva técnica probada');

      expect(sessionsRepo.updateExerciseNotes).toHaveBeenCalledWith(userId, exerciseId, 'Nueva técnica probada');
      expect(result.notes).toBe('Nueva técnica probada');
    });
  });
});

