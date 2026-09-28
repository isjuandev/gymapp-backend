import { Injectable } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { UpdateCustomScheduleDto } from './dto/update-custom-schedule.dto';
import { CustomScheduleDayDto } from './dto/custom-schedule-response.dto';
import { PlanService } from '../plan/plan.service';

// Canonical order now lives in plan/utils (single definition); re-exported
// here so existing importers keep working.
export { DAYS_OF_WEEK_ORDER } from '../plan/utils/date.utils';

/**
 * Thin facade over PlanService (Fase 2 consistency).
 * The materialized weekly schedule has exactly two writers, both in
 * PlanService: assignPlan (PRESET_GENERATED) and upsertCustomScheduleDay
 * (MANUAL, custom plans only). This service performs no direct writes.
 */
@Injectable()
export class CustomScheduleService {
  constructor(private readonly planService: PlanService) {}

  /**
   * Retrieves all 7 weekday routine assignments for the authenticated user.
   * Days without a row come back as unconfigured
   * (workoutId: null, isRestDay: false).
   */
  async getSchedule(userId: string): Promise<CustomScheduleDayDto[]> {
    return this.planService.readSchedule(userId);
  }

  /**
   * Manual edit path for CUSTOM plans. Ensures/updates the canonical CUSTOM
   * UserPlan (converting a PRESET and keeping its rows as the starting point)
   * and upserts the day as MANUAL, all in one transaction.
   */
  async updateDaySchedule(
    userId: string,
    dayOfWeek: DayOfWeek,
    dto: UpdateCustomScheduleDto,
  ): Promise<CustomScheduleDayDto> {
    return this.planService.upsertCustomScheduleDay(userId, dayOfWeek, dto);
  }
}
