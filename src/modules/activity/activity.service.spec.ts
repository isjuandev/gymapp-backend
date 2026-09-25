import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { ActivityRepository } from './repositories/activity.repository';

describe('ActivityService', () => {
  let service: ActivityService;
  let repository: jest.Mocked<ActivityRepository>;

  const userId = 'user-uuid-1111';

  const mockSnapshot = {
    id: 'snap-uuid-1',
    userId,
    date: new Date('2026-09-24T00:00:00.000Z'),
    steps: 8500,
    stepsGoal: 10000,
    caloriesActive: 450.5,
    sleepHours: 7.5,
    avgHeartRate: 72,
    distanceKm: 6.2,
  };

  beforeEach(async () => {
    const mockRepo = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(),
      findByUserAndDateRange: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: ActivityRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    repository = module.get(ActivityRepository);
  });

  describe('createSnapshot', () => {
    it('should normalize date to start of UTC day and upsert snapshot without altering sensor values', async () => {
      repository.upsert.mockResolvedValue(mockSnapshot);

      const result = await service.createSnapshot(userId, {
        date: '2026-09-24T18:45:00.000Z',
        steps: 8500,
        stepsGoal: 10000,
        caloriesActive: 450.5,
        sleepHours: 7.5,
        avgHeartRate: 72,
        distanceKm: 6.2,
      });

      expect(repository.upsert).toHaveBeenCalledWith(userId, {
        date: new Date(Date.UTC(2026, 8, 24, 0, 0, 0, 0)),
        steps: 8500,
        stepsGoal: 10000,
        caloriesActive: 450.5,
        sleepHours: 7.5,
        avgHeartRate: 72,
        distanceKm: 6.2,
      });

      expect(result).toEqual({
        id: mockSnapshot.id,
        userId,
        date: mockSnapshot.date.toISOString(),
        steps: 8500,
        stepsGoal: 10000,
        caloriesActive: 450.5,
        sleepHours: 7.5,
        avgHeartRate: 72,
        distanceKm: 6.2,
      });
    });
  });

  describe('createSnapshotsBatch', () => {
    it('should map items, normalize dates and call transactional upsertBatch', async () => {
      repository.upsertBatch.mockResolvedValue([mockSnapshot]);

      const result = await service.createSnapshotsBatch(userId, [
        {
          date: '2026-09-24T21:00:00.000Z',
          steps: 8500,
          stepsGoal: 10000,
          caloriesActive: 450.5,
          sleepHours: 7.5,
          avgHeartRate: 72,
          distanceKm: 6.2,
        },
      ]);

      expect(repository.upsertBatch).toHaveBeenCalledWith(userId, [
        {
          date: new Date(Date.UTC(2026, 8, 24, 0, 0, 0, 0)),
          steps: 8500,
          stepsGoal: 10000,
          caloriesActive: 450.5,
          sleepHours: 7.5,
          avgHeartRate: 72,
          distanceKm: 6.2,
        },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockSnapshot.id);
    });
  });

  describe('getSnapshots', () => {
    it('should query snapshots with from and to date ranges', async () => {
      repository.findByUserAndDateRange.mockResolvedValue([mockSnapshot]);

      const result = await service.getSnapshots(userId, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T00:00:00.000Z',
      });

      expect(repository.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        new Date(Date.UTC(2026, 8, 1, 0, 0, 0, 0)),
        new Date(Date.UTC(2026, 8, 30, 23, 59, 59, 999)),
      );

      expect(result).toHaveLength(1);
      expect(result[0].steps).toBe(8500);
    });

    it('should query snapshots without date filters when query is empty', async () => {
      repository.findByUserAndDateRange.mockResolvedValue([]);

      const result = await service.getSnapshots(userId);

      expect(repository.findByUserAndDateRange).toHaveBeenCalledWith(
        userId,
        undefined,
        undefined,
      );
      expect(result).toEqual([]);
    });
  });
});
