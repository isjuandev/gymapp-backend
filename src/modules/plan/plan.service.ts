import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PlanRepository } from './repositories/plan.repository';
import { WorkoutsRepository } from '../workouts/repositories/workouts.repository';
import { RecommendationService } from '../recommendation/recommendation.service';
import { getMondayOfWeek, parseWeekStartDate } from './utils/date.utils';
import { UpdatePlanDayDto } from './dto/update-plan-day.dto';
import { WeeklyPlanResponseDto } from './dto/weekly-plan-response.dto';
import { PlanDayResponseDto } from './dto/plan-day-response.dto';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly planRepository: PlanRepository,
    private readonly workoutsRepository: WorkoutsRepository,
    private readonly recommendationService: RecommendationService,
  ) {}

  /**
   * GET /plan/current: Retrieves or automatically generates the current week's WeeklyPlan.
   */
  async getCurrentPlan(userId: string): Promise<WeeklyPlanResponseDto> {
    const monday = getMondayOfWeek(new Date());
    return this.getOrCreateWeeklyPlan(userId, monday);
  }

  /**
   * GET /plan?weekStartDate=YYYY-MM-DD: Retrieves or generates the WeeklyPlan for a specified week.
   */
  async getPlanByWeek(
    userId: string,
    weekStartDateInput?: string,
  ): Promise<WeeklyPlanResponseDto> {
    const monday = parseWeekStartDate(weekStartDateInput);
    return this.getOrCreateWeeklyPlan(userId, monday);
  }

  /**
   * PATCH /plan/days/:planDayId: Manually reschedule or toggle rest day with strict ownership validation.
   */
  async updatePlanDay(
    planDayId: string,
    userId: string,
    dto: UpdatePlanDayDto,
  ): Promise<PlanDayResponseDto> {
    const planDay = await this.planRepository.findPlanDayById(planDayId);
    if (!planDay) {
      throw new NotFoundException(`Plan day with ID '${planDayId}' not found`);
    }

    // Ownership check: ensure this planDay belongs to the authenticated user's weeklyPlan
    if (planDay.weeklyPlan.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this plan day',
      );
    }

    // If a new workoutId is provided, verify it exists in the catalog
    if (dto.workoutId) {
      const workout = await this.workoutsRepository.findById(dto.workoutId);
      if (!workout) {
        throw new NotFoundException(
          `Workout with ID '${dto.workoutId}' not found`,
        );
      }
    }

    // If marked as rest day, clear workoutId unless an explicit workout was also provided
    const updateData: UpdatePlanDayDto = { ...dto };
    if (dto.isRestDay === true && dto.workoutId === undefined) {
      updateData.workoutId = null;
    } else if (dto.workoutId) {
      // If a workout is assigned, ensure isRestDay is false
      updateData.isRestDay = false;
    }

    const updated = await this.planRepository.updatePlanDay(
      planDayId,
      updateData,
    );
    return PlanDayResponseDto.fromEntity(updated);
  }

  /**
   * Internal helper: Finds existing plan for the given Monday or provisions one
   * via RecommendationService based on the user's onboarding profile and equipment preferences.
   */
  private async getOrCreateWeeklyPlan(
    userId: string,
    monday: Date,
  ): Promise<WeeklyPlanResponseDto> {
    const existing = await this.planRepository.findWeeklyPlanByWeek(
      userId,
      monday,
    );
    if (existing) {
      return WeeklyPlanResponseDto.fromEntityWithDays(existing);
    }

    this.logger.log(
      `No WeeklyPlan found for user ${userId} on week ${monday.toISOString().slice(0, 10)}. Auto-generating via RecommendationService.`,
    );

    const generated = await this.recommendationService.generateWeeklyPlan(
      userId,
      monday,
    );

    return WeeklyPlanResponseDto.fromEntityWithDays(generated);
  }
}
