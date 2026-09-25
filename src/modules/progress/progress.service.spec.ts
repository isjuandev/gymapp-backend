import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressRepository } from './repositories/progress.repository';
import { GoalType } from '@prisma/client';
import { WeightRangeFilter } from './dto';

describe('ProgressService', () => {
  let service: ProgressService;
  let repository: jest.Mocked<ProgressRepository>;

  const userId = 'user-uuid-1111';
  const otherUserId = 'user-uuid-2222';
  const goalId = 'goal-uuid-3333';

  const mockGoal = {
    id: goalId,
    userId,
    type: GoalType.LOSE_WEIGHT,
    targetValue: 70.0,
    currentValue: 78.5,
    deadline: new Date('2026-12-31T23:59:59.000Z'),
    createdAt: new Date('2026-09-24T12:00:00.000Z'),
  };

  const mockWeightEntry = {
    id: 'entry-uuid-1',
    userId,
    date: new Date('2026-09-24T00:00:00.000Z'),
    weightKg: 78.5,
    createdAt: new Date('2026-09-24T12:00:00.000Z'),
  };

  beforeEach(async () => {
    const mockRepo = {
      upsertWeightEntryWithGoalUpdate: jest.fn(),
      findWeightEntriesByRange: jest.fn(),
      findActiveGoal: jest.fn(),
      findGoalById: jest.fn(),
      createGoal: jest.fn(),
      updateGoal: jest.fn(),
      getMonthWorkoutStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: ProgressRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
    repository = module.get(ProgressRepository);
  });

  describe('addWeightEntry', () => {
    it('should normalize date to start of UTC day and upsert entry', async () => {
      repository.upsertWeightEntryWithGoalUpdate.mockResolvedValue(
        mockWeightEntry,
      );

      const result = await service.addWeightEntry(userId, {
        date: '2026-09-24T15:30:00.000Z',
        weightKg: 78.5,
      });

      expect(repository.upsertWeightEntryWithGoalUpdate).toHaveBeenCalledWith(
        userId,
        new Date(Date.UTC(2026, 8, 24, 0, 0, 0, 0)),
        78.5,
      );
      expect(result).toEqual({
        id: mockWeightEntry.id,
        userId,
        date: mockWeightEntry.date.toISOString(),
        weightKg: 78.5,
        createdAt: mockWeightEntry.createdAt.toISOString(),
      });
    });
  });

  describe('getWeightEntries', () => {
    it('should use default 30D range when range is not specified', async () => {
      repository.findWeightEntriesByRange.mockResolvedValue([mockWeightEntry]);

      const result = await service.getWeightEntries(userId);

      expect(repository.findWeightEntriesByRange).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockWeightEntry.id);
    });

    it('should calculate correct fromDate for 7D range', async () => {
      repository.findWeightEntriesByRange.mockResolvedValue([]);

      await service.getWeightEntries(userId, WeightRangeFilter.SEVEN_DAYS);

      expect(repository.findWeightEntriesByRange).toHaveBeenCalled();
    });
  });

  describe('getCurrentGoal', () => {
    it('should return active goal if found', async () => {
      repository.findActiveGoal.mockResolvedValue(mockGoal);

      const result = await service.getCurrentGoal(userId);

      expect(repository.findActiveGoal).toHaveBeenCalledWith(userId);
      expect(result.id).toBe(mockGoal.id);
      expect(result.type).toBe(mockGoal.type);
    });

    it('should throw NotFoundException if no active goal is found', async () => {
      repository.findActiveGoal.mockResolvedValue(null);

      await expect(service.getCurrentGoal(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createGoal', () => {
    it('should create and return new goal', async () => {
      repository.createGoal.mockResolvedValue(mockGoal);

      const result = await service.createGoal(userId, {
        type: GoalType.LOSE_WEIGHT,
        targetValue: 70.0,
        currentValue: 78.5,
        deadline: '2026-12-31T23:59:59.000Z',
      });

      expect(repository.createGoal).toHaveBeenCalledWith(userId, {
        type: GoalType.LOSE_WEIGHT,
        targetValue: 70.0,
        currentValue: 78.5,
        deadline: new Date('2026-12-31T23:59:59.000Z'),
      });
      expect(result.id).toBe(mockGoal.id);
    });
  });

  describe('updateGoal', () => {
    it('should throw NotFoundException if goal does not exist', async () => {
      repository.findGoalById.mockResolvedValue(null);

      await expect(
        service.updateGoal(userId, 'non-existent', { currentValue: 76 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if goal belongs to another user', async () => {
      repository.findGoalById.mockResolvedValue({
        ...mockGoal,
        userId: otherUserId,
      });

      await expect(
        service.updateGoal(userId, goalId, { currentValue: 76 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update and return goal when user is owner', async () => {
      repository.findGoalById.mockResolvedValue(mockGoal);
      repository.updateGoal.mockResolvedValue({
        ...mockGoal,
        currentValue: 76.0,
      });

      const result = await service.updateGoal(userId, goalId, {
        currentValue: 76.0,
      });

      expect(repository.updateGoal).toHaveBeenCalledWith(goalId, {
        targetValue: undefined,
        currentValue: 76.0,
        deadline: undefined,
      });
      expect(result.currentValue).toBe(76.0);
    });
  });

  describe('getProgressStats', () => {
    it('should return aggregated monthly stats', async () => {
      repository.getMonthWorkoutStats.mockResolvedValue({
        workoutsThisMonth: 14,
        activeTimeThisMonth: 25200,
      });

      const result = await service.getProgressStats(userId);

      expect(repository.getMonthWorkoutStats).toHaveBeenCalledWith(
        userId,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual({
        workoutsThisMonth: 14,
        activeTimeThisMonth: 25200,
      });
    });
  });

  describe('calculateFromDate', () => {
    const fixedNow = new Date('2026-09-24T12:00:00.000Z');

    it('should calculate 7D fromDate correctly', () => {
      const from = service.calculateFromDate(
        WeightRangeFilter.SEVEN_DAYS,
        fixedNow,
      );
      expect(from.toISOString()).toBe('2026-09-17T00:00:00.000Z');
    });

    it('should calculate 30D fromDate correctly', () => {
      const from = service.calculateFromDate(
        WeightRangeFilter.THIRTY_DAYS,
        fixedNow,
      );
      expect(from.toISOString()).toBe('2026-08-25T00:00:00.000Z');
    });

    it('should calculate 3M fromDate correctly', () => {
      const from = service.calculateFromDate(
        WeightRangeFilter.THREE_MONTHS,
        fixedNow,
      );
      expect(from.toISOString()).toBe('2026-06-24T00:00:00.000Z');
    });

    it('should calculate 6M fromDate correctly', () => {
      const from = service.calculateFromDate(
        WeightRangeFilter.SIX_MONTHS,
        fixedNow,
      );
      expect(from.toISOString()).toBe('2026-03-24T00:00:00.000Z');
    });

    it('should calculate 1Y fromDate correctly', () => {
      const from = service.calculateFromDate(
        WeightRangeFilter.ONE_YEAR,
        fixedNow,
      );
      expect(from.toISOString()).toBe('2025-09-24T00:00:00.000Z');
    });
  });
});
