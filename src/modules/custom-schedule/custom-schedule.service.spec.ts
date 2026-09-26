import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomScheduleService, DAYS_OF_WEEK_ORDER } from './custom-schedule.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';

describe('CustomScheduleService', () => {
  let service: CustomScheduleService;
  let prisma: {
    customRoutineDayAssignment: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    workout: {
      findUnique: jest.Mock;
    };
  };

  const userId = 'user-123';

  beforeEach(async () => {
    prisma = {
      customRoutineDayAssignment: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      workout: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomScheduleService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CustomScheduleService>(CustomScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSchedule', () => {
    it('should return all 7 days with defaults when no assignments exist in DB', async () => {
      prisma.customRoutineDayAssignment.findMany.mockResolvedValue([]);

      const result = await service.getSchedule(userId);

      expect(result).toHaveLength(7);
      expect(result.map((d) => d.dayOfWeek)).toEqual(DAYS_OF_WEEK_ORDER);
      for (const day of result) {
        expect(day.id).toBeNull();
        expect(day.userId).toBe(userId);
        expect(day.workoutId).toBeNull();
        expect(day.isRestDay).toBe(false);
        expect(day.workout).toBeNull();
      }
    });

    it('should return 7 days merging existing assignments and unconfigured days', async () => {
      const mockWorkout = {
        id: 'workout-1',
        title: 'Pierna Pesada',
        durationMinutes: 60,
        difficulty: 'Avanzado',
        kcalEstimate: 500,
        imageAssetName: 'leg_day',
        rounds: 4,
        exercises: [{ id: 'ex-1', name: 'Sentadilla' }],
      };

      prisma.customRoutineDayAssignment.findMany.mockResolvedValue([
        {
          id: 'assign-1',
          userId,
          dayOfWeek: DayOfWeek.MONDAY,
          workoutId: 'workout-1',
          isRestDay: false,
          workout: mockWorkout,
        },
        {
          id: 'assign-2',
          userId,
          dayOfWeek: DayOfWeek.SUNDAY,
          workoutId: null,
          isRestDay: true,
          workout: null,
        },
      ]);

      const result = await service.getSchedule(userId);

      expect(result).toHaveLength(7);

      const monday = result.find((d) => d.dayOfWeek === DayOfWeek.MONDAY);
      expect(monday).toBeDefined();
      expect(monday?.id).toBe('assign-1');
      expect(monday?.workoutId).toBe('workout-1');
      expect(monday?.isRestDay).toBe(false);
      expect(monday?.workout?.title).toBe('Pierna Pesada');
      expect(monday?.workout?.exercisesCount).toBe(1);

      const sunday = result.find((d) => d.dayOfWeek === DayOfWeek.SUNDAY);
      expect(sunday).toBeDefined();
      expect(sunday?.id).toBe('assign-2');
      expect(sunday?.workoutId).toBeNull();
      expect(sunday?.isRestDay).toBe(true);
      expect(sunday?.workout).toBeNull();

      const tuesday = result.find((d) => d.dayOfWeek === DayOfWeek.TUESDAY);
      expect(tuesday).toBeDefined();
      expect(tuesday?.id).toBeNull();
      expect(tuesday?.workoutId).toBeNull();
      expect(tuesday?.isRestDay).toBe(false);
    });
  });

  describe('updateDaySchedule', () => {
    it('should throw BadRequestException if both workoutId and isRestDay are provided', async () => {
      await expect(
        service.updateDaySchedule(userId, DayOfWeek.MONDAY, {
          workoutId: 'workout-1',
          isRestDay: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if neither workoutId nor isRestDay are provided', async () => {
      await expect(
        service.updateDaySchedule(userId, DayOfWeek.MONDAY, {}),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateDaySchedule(userId, DayOfWeek.MONDAY, {
          workoutId: '',
          isRestDay: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if workoutId does not exist', async () => {
      prisma.workout.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDaySchedule(userId, DayOfWeek.MONDAY, {
          workoutId: 'non-existent-workout',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if workout belongs to another user or is a catalog workout', async () => {
      prisma.workout.findUnique.mockResolvedValue({
        id: 'workout-catalog',
        ownerUserId: null,
      });

      await expect(
        service.updateDaySchedule(userId, DayOfWeek.MONDAY, {
          workoutId: 'workout-catalog',
        }),
      ).rejects.toThrow(BadRequestException);

      prisma.workout.findUnique.mockResolvedValue({
        id: 'workout-other',
        ownerUserId: 'other-user',
      });

      await expect(
        service.updateDaySchedule(userId, DayOfWeek.MONDAY, {
          workoutId: 'workout-other',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully upsert a custom routine assignment', async () => {
      const mockWorkout = {
        id: 'workout-1',
        ownerUserId: userId,
        title: 'Mi Rutina de Pecho',
        durationMinutes: 45,
        difficulty: 'Intermedio',
        kcalEstimate: 350,
        imageAssetName: 'chest',
        rounds: 3,
        exercises: [],
      };

      prisma.workout.findUnique.mockResolvedValue(mockWorkout);
      prisma.customRoutineDayAssignment.upsert.mockResolvedValue({
        id: 'assignment-1',
        userId,
        dayOfWeek: DayOfWeek.MONDAY,
        workoutId: 'workout-1',
        isRestDay: false,
        workout: mockWorkout,
      });

      const result = await service.updateDaySchedule(userId, DayOfWeek.MONDAY, {
        workoutId: 'workout-1',
      });

      expect(prisma.workout.findUnique).toHaveBeenCalledWith({
        where: { id: 'workout-1' },
        include: { exercises: true },
      });

      expect(prisma.customRoutineDayAssignment.upsert).toHaveBeenCalledWith({
        where: {
          userId_dayOfWeek: {
            userId,
            dayOfWeek: DayOfWeek.MONDAY,
          },
        },
        create: {
          userId,
          dayOfWeek: DayOfWeek.MONDAY,
          workoutId: 'workout-1',
          isRestDay: false,
        },
        update: {
          workoutId: 'workout-1',
          isRestDay: false,
        },
        include: {
          workout: {
            include: {
              exercises: true,
            },
          },
        },
      });

      expect(result.id).toBe('assignment-1');
      expect(result.dayOfWeek).toBe(DayOfWeek.MONDAY);
      expect(result.workoutId).toBe('workout-1');
      expect(result.isRestDay).toBe(false);
      expect(result.workout?.title).toBe('Mi Rutina de Pecho');
    });

    it('should successfully upsert a rest day assignment without querying workout', async () => {
      prisma.customRoutineDayAssignment.upsert.mockResolvedValue({
        id: 'assignment-rest',
        userId,
        dayOfWeek: DayOfWeek.SUNDAY,
        workoutId: null,
        isRestDay: true,
        workout: null,
      });

      const result = await service.updateDaySchedule(userId, DayOfWeek.SUNDAY, {
        isRestDay: true,
      });

      expect(prisma.workout.findUnique).not.toHaveBeenCalled();
      expect(prisma.customRoutineDayAssignment.upsert).toHaveBeenCalledWith({
        where: {
          userId_dayOfWeek: {
            userId,
            dayOfWeek: DayOfWeek.SUNDAY,
          },
        },
        create: {
          userId,
          dayOfWeek: DayOfWeek.SUNDAY,
          workoutId: null,
          isRestDay: true,
        },
        update: {
          workoutId: null,
          isRestDay: true,
        },
        include: {
          workout: {
            include: {
              exercises: true,
            },
          },
        },
      });

      expect(result.id).toBe('assignment-rest');
      expect(result.dayOfWeek).toBe(DayOfWeek.SUNDAY);
      expect(result.workoutId).toBeNull();
      expect(result.isRestDay).toBe(true);
      expect(result.workout).toBeNull();
    });
  });
});
