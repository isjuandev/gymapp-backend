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

  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';
  const sessionId = '33333333-3333-4333-8333-333333333333';
  const workoutId = '44444444-4444-4444-8444-444444444444';
  const exerciseId = '55555555-5555-4555-8555-555555555555';
  const setId = '66666666-6666-4666-8666-666666666666';

  const mockSession = {
    id: sessionId,
    userId,
    workoutId,
    date: new Date('2026-09-26T10:00:00.000Z'),
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
      createBatchSetLogs: jest.fn(),
      findSetLogsBySessionId: jest.fn(),
      findSetLogById: jest.fn(),
      deleteSetLog: jest.fn(),
      findExerciseWithDetails: jest.fn(),
      findExerciseInWorkout: jest.fn(),
      findProgressState: jest.fn(),
      findAllProgressStatesForUser: jest.fn(),
      upsertProgressState: jest.fn(),
      findExerciseSessionHistory: jest.fn(),
      updateExerciseNotes: jest.fn(),
    };

    const mockWorkoutsRepo = {
      findById: jest.fn(),
      findByIdWithExercises: jest.fn(),
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
      workoutsRepo.findByIdWithExercises.mockResolvedValue({
        ...mockSession.workout,
        exercises: [mockExercise],
      } as any);

      sessionsRepo.completeSession.mockResolvedValue({
        ...mockSession,
        status: WorkoutSessionStatus.COMPLETED,
        durationActualSeconds: 2700,
        kcalBurned: 420,
        avgHeartRate: 135,
      } as any);

      // Mock 2 working sets hitting 12 reps at 40kg
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

      // Previous state: already completed 1 session at 40kg on an earlier date
      sessionsRepo.findProgressState.mockResolvedValue({
        id: 'prog-1',
        userId,
        exerciseId,
        currentWorkingWeightKg: 40,
        consecutiveSessionsAtTarget: 1,
        suggestedNextWeightKg: null,
        lastSessionDate: new Date('2026-09-24T10:00:00.000Z'),
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

    it('should throw BadRequestException if workout has exercises but 0 sets were logged', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      workoutsRepo.findByIdWithExercises.mockResolvedValue({
        ...mockSession.workout,
        exercises: [mockExercise],
      } as any);
      sessionsRepo.findSetLogsBySessionId.mockResolvedValue([]);

      await expect(
        service.completeSession(sessionId, userId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should automatically derive duration and kcal if 0 or null are provided', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      workoutsRepo.findByIdWithExercises.mockResolvedValue({
        ...mockSession.workout,
        durationMinutes: 45,
        kcalEstimate: 380,
        exercises: [mockExercise],
      } as any);

      sessionsRepo.findSetLogsBySessionId.mockResolvedValue([
        {
          id: 'set-1',
          workoutSessionId: sessionId,
          exerciseId,
          setNumber: 1,
          weightKg: 30,
          reps: 10,
          isWarmup: false,
          completedAt: new Date('2026-09-26T10:00:00.000Z'),
        },
        {
          id: 'set-2',
          workoutSessionId: sessionId,
          exerciseId,
          setNumber: 2,
          weightKg: 30,
          reps: 10,
          isWarmup: false,
          completedAt: new Date('2026-09-26T10:30:00.000Z'),
        },
      ] as any);

      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.completeSession.mockResolvedValue({
        ...mockSession,
        status: WorkoutSessionStatus.COMPLETED,
      } as any);

      await service.completeSession(sessionId, userId, {
        durationActualSeconds: 0,
        kcalBurned: null,
      });

      expect(sessionsRepo.completeSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          durationActualSeconds: expect.any(Number),
          kcalBurned: 380,
        }),
      );
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
    it('should log a completed set for an exercise in progress and update PR/progression', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findExerciseInWorkout.mockResolvedValue(mockExercise as any);
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

      const result = await service.addSetLog(sessionId, userId, {
        exerciseId,
        setNumber: 1,
        weightKg: 40,
        reps: 12,
        isWarmup: false,
        rpe: 8,
      });

      expect(sessionsRepo.findExerciseInWorkout).toHaveBeenCalledWith(
        workoutId,
        exerciseId,
      );
      expect(sessionsRepo.createSetLog).toHaveBeenCalledWith(sessionId, {
        exerciseId,
        setNumber: 1,
        weightKg: 40,
        reps: 12,
        isWarmup: false,
        rpe: 8,
      });
      expect(sessionsRepo.upsertProgressState).toHaveBeenCalled();
      expect(result.id).toBe(setId);
      expect(result.weightKg).toBe(40);
      expect(result.reps).toBe(12);
    });

    it('should reject set log if exercise does not belong to workout', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findExerciseInWorkout.mockResolvedValue(null);

      await expect(
        service.addSetLog(sessionId, userId, {
          exerciseId: 'different-exercise-id',
          setNumber: 1,
          weightKg: 40,
          reps: 12,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log batch sets in a single transaction (batch / retrospective mode)', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findExerciseInWorkout.mockResolvedValue(mockExercise as any);
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);

      const mockCreatedLogs = [
        {
          id: 'set-b1',
          workoutSessionId: sessionId,
          exerciseId,
          setNumber: 1,
          weightKg: 50,
          reps: 10,
          isWarmup: false,
          rpe: 8,
          completedAt: new Date(),
        },
        {
          id: 'set-b2',
          workoutSessionId: sessionId,
          exerciseId,
          setNumber: 2,
          weightKg: 50,
          reps: 10,
          isWarmup: false,
          rpe: 8.5,
          completedAt: new Date(),
        },
      ];

      sessionsRepo.createBatchSetLogs.mockResolvedValue(mockCreatedLogs as any);
      sessionsRepo.findSetLogsBySessionId.mockResolvedValue(
        mockCreatedLogs as any,
      );

      const result = await service.addBatchSetLogs(sessionId, userId, {
        sets: [
          {
            exerciseId,
            setNumber: 1,
            weightKg: 50,
            reps: 10,
          },
          {
            exerciseId,
            setNumber: 2,
            weightKg: 50,
            reps: 10,
          },
        ],
      });

      expect(sessionsRepo.createBatchSetLogs).toHaveBeenCalledWith(
        sessionId,
        expect.arrayContaining([
          expect.objectContaining({ setNumber: 1, weightKg: 50 }),
          expect.objectContaining({ setNumber: 2, weightKg: 50 }),
        ]),
      );
      expect(sessionsRepo.upsertProgressState).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('set-b1');
      expect(result[1].id).toBe('set-b2');
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

      const result = await service.getSessionSets(sessionId, userId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(setId);
    });

    it('should delete a set log from an in-progress session', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.findSetLogById.mockResolvedValue({
        id: setId,
        workoutSessionId: sessionId,
      } as any);
      sessionsRepo.deleteSetLog.mockResolvedValue({} as any);

      const result = await service.deleteSetLog(sessionId, setId, userId);
      expect(result.message).toBe('Set log deleted successfully');
      expect(sessionsRepo.deleteSetLog).toHaveBeenCalledWith(setId);
    });
  });

  describe('getExerciseProgress', () => {
    it('should return progressive overload status and mastery badge', async () => {
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.findProgressState.mockResolvedValue({
        userId,
        exerciseId,
        currentWorkingWeightKg: 40,
        consecutiveSessionsAtTarget: 2,
        suggestedNextWeightKg: 42.5,
        lastSessionDate: new Date(),
      } as any);

      const result = await service.getExerciseProgress(userId, exerciseId);

      expect(result.currentWorkingWeightKg).toBe(40);
      expect(result.isMastered).toBe(true);
      expect(result.suggestedNextWeightKg).toBe(42.5);
    });
  });

  describe('getExerciseHistory', () => {
    it('should return session history, identify PR and user notes', async () => {
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.findProgressState.mockResolvedValue({
        notes: 'Codos pegados al cuerpo',
      } as any);

      sessionsRepo.findExerciseSessionHistory.mockResolvedValue([
        {
          workoutSessionId: 'session-1',
          weightKg: 40,
          reps: 10,
          isWarmup: false,
          completedAt: new Date('2026-09-10T10:00:00.000Z'),
        },
        {
          workoutSessionId: 'session-2',
          weightKg: 45,
          reps: 8,
          isWarmup: false,
          completedAt: new Date('2026-09-15T10:00:00.000Z'),
        },
      ] as any);

      const history = await service.getExerciseHistory(userId, exerciseId);

      expect(history.exerciseName).toBe('Press de Banca Plano');
      expect(history.userNotes).toBe('Codos pegados al cuerpo');
      expect(history.personalRecord).not.toBeNull();
      expect(history.personalRecord?.weightKg).toBe(45);
      expect(history.personalRecord?.reps).toBe(8);
      expect(history.history).toHaveLength(2);
      expect(history.history[1].isPR).toBe(true);
    });
  });

  describe('updateExerciseNotes', () => {
    it('should save notes to exercise progress state', async () => {
      sessionsRepo.findExerciseWithDetails.mockResolvedValue(mockExercise as any);
      sessionsRepo.updateExerciseNotes.mockResolvedValue({
        notes: 'Mantener escápulas retraídas',
      } as any);

      const result = await service.updateExerciseNotes(
        userId,
        exerciseId,
        'Mantener escápulas retraídas',
      );

      expect(result.notes).toBe('Mantener escápulas retraídas');
      expect(sessionsRepo.updateExerciseNotes).toHaveBeenCalledWith(
        userId,
        exerciseId,
        'Mantener escápulas retraídas',
      );
    });
  });
});
