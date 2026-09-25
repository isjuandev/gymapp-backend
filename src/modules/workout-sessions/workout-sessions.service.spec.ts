import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
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

  beforeEach(async () => {
    const mockSessionsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserAndDateRange: jest.fn(),
      completeSession: jest.fn(),
      skipSession: jest.fn(),
      updateMatchingPlanDayToCompleted: jest.fn(),
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

  describe('completeSession (CompleteWorkoutSessionUseCase)', () => {
    it('should complete session and synchronize matching plan day', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.completeSession.mockResolvedValue({
        ...mockSession,
        status: WorkoutSessionStatus.COMPLETED,
        durationActualSeconds: 2700,
        kcalBurned: 420,
        avgHeartRate: 135,
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
      expect(
        sessionsRepo.updateMatchingPlanDayToCompleted,
      ).toHaveBeenCalledWith(userId, workoutId, mockSession.date);
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

    it('should throw NotFoundException if session does not exist', async () => {
      sessionsRepo.findById.mockResolvedValue(null);

      await expect(
        service.completeSession('unknown-id', userId, {
          durationActualSeconds: 2700,
          kcalBurned: 400,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('skipSession', () => {
    it('should mark session as SKIPPED for session owner', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);
      sessionsRepo.skipSession.mockResolvedValue({
        ...mockSession,
        status: WorkoutSessionStatus.SKIPPED,
      } as any);

      const result = await service.skipSession(sessionId, userId);
      expect(result.status).toBe(WorkoutSessionStatus.SKIPPED);
    });

    it('should throw ForbiddenException if user does not own session', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);

      await expect(service.skipSession(sessionId, otherUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if session was already COMPLETED', async () => {
      sessionsRepo.findById.mockResolvedValue({
        ...mockSession,
        status: WorkoutSessionStatus.COMPLETED,
      } as any);

      await expect(service.skipSession(sessionId, userId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return session history for authenticated user', async () => {
      sessionsRepo.findByUserAndDateRange.mockResolvedValue([
        mockSession as any,
      ]);

      const result = await service.getUserSessions(userId, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T23:59:59.999Z',
      });

      expect(sessionsRepo.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-09-30T23:59:59.999Z'),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(sessionId);
    });
  });

  describe('getSessionById', () => {
    it('should return session for owner', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);

      const result = await service.getSessionById(sessionId, userId);
      expect(result.id).toBe(sessionId);
    });

    it('should throw ForbiddenException when accessing another user session', async () => {
      sessionsRepo.findById.mockResolvedValue(mockSession as any);

      await expect(
        service.getSessionById(sessionId, otherUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
