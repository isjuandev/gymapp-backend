import { Test, TestingModule } from '@nestjs/testing';
import {
  CustomScheduleService,
  DAYS_OF_WEEK_ORDER,
} from './custom-schedule.service';
import { PlanService } from '../plan/plan.service';
import { DayOfWeek } from '@prisma/client';

/**
 * CustomScheduleService is a thin facade over PlanService (Fase 2 single
 * writer). These tests verify delegation; transactional behavior is covered
 * by plan-consistency specs.
 */
describe('CustomScheduleService', () => {
  let service: CustomScheduleService;
  let planService: {
    readSchedule: jest.Mock;
    upsertCustomScheduleDay: jest.Mock;
  };

  const userId = 'user-123';

  beforeEach(async () => {
    planService = {
      readSchedule: jest.fn(),
      upsertCustomScheduleDay: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomScheduleService,
        { provide: PlanService, useValue: planService },
      ],
    }).compile();

    service = module.get<CustomScheduleService>(CustomScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should re-export the canonical weekday order', () => {
    expect(DAYS_OF_WEEK_ORDER).toEqual([
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY,
    ]);
  });

  describe('getSchedule', () => {
    it('should delegate reads to PlanService.readSchedule', async () => {
      const days = [{ dayOfWeek: DayOfWeek.MONDAY }];
      planService.readSchedule.mockResolvedValue(days);

      const result = await service.getSchedule(userId);

      expect(planService.readSchedule).toHaveBeenCalledWith(userId);
      expect(result).toBe(days);
    });
  });

  describe('updateDaySchedule', () => {
    it('should delegate manual edits to PlanService.upsertCustomScheduleDay', async () => {
      const dto = { workoutId: 'workout-1' };
      const updated = { dayOfWeek: DayOfWeek.MONDAY };
      planService.upsertCustomScheduleDay.mockResolvedValue(updated);

      const result = await service.updateDaySchedule(
        userId,
        DayOfWeek.MONDAY,
        dto as any,
      );

      expect(planService.upsertCustomScheduleDay).toHaveBeenCalledWith(
        userId,
        DayOfWeek.MONDAY,
        dto,
      );
      expect(result).toBe(updated);
    });
  });
});
