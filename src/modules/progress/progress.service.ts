import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Goal, WeightEntry } from '@prisma/client';
import {
  CreateGoalDto,
  CreateWeightEntryDto,
  GoalResponseDto,
  ProgressStatsResponseDto,
  UpdateGoalDto,
  WeightEntryResponseDto,
  WeightRangeFilter,
} from './dto';
import { ProgressRepository } from './repositories/progress.repository';

@Injectable()
export class ProgressService {
  constructor(private readonly progressRepository: ProgressRepository) {}

  async addWeightEntry(
    userId: string,
    dto: CreateWeightEntryDto,
  ): Promise<WeightEntryResponseDto> {
    const rawDate = new Date(dto.date);
    // Normalize to UTC start of day so that entries for the same calendar date collide and upsert
    const normalizedDate = new Date(
      Date.UTC(
        rawDate.getUTCFullYear(),
        rawDate.getUTCMonth(),
        rawDate.getUTCDate(),
      ),
    );

    const entry = await this.progressRepository.upsertWeightEntryWithGoalUpdate(
      userId,
      normalizedDate,
      dto.weightKg,
    );

    return this.toWeightEntryResponseDto(entry);
  }

  async getWeightEntries(
    userId: string,
    range?: WeightRangeFilter,
  ): Promise<WeightEntryResponseDto[]> {
    const filter = range ?? WeightRangeFilter.THIRTY_DAYS;
    const fromDate = this.calculateFromDate(filter);
    const entries = await this.progressRepository.findWeightEntriesByRange(
      userId,
      fromDate,
    );
    return entries.map((entry) => this.toWeightEntryResponseDto(entry));
  }

  async getCurrentGoal(userId: string): Promise<GoalResponseDto> {
    const goal = await this.progressRepository.findActiveGoal(userId);
    if (!goal) {
      throw new NotFoundException('No active goal found for this user');
    }
    return this.toGoalResponseDto(goal);
  }

  async createGoal(
    userId: string,
    dto: CreateGoalDto,
  ): Promise<GoalResponseDto> {
    const deadline = dto.deadline ? new Date(dto.deadline) : null;
    const goal = await this.progressRepository.createGoal(userId, {
      type: dto.type,
      targetValue: dto.targetValue,
      currentValue: dto.currentValue,
      deadline,
    });
    return this.toGoalResponseDto(goal);
  }

  async updateGoal(
    userId: string,
    goalId: string,
    dto: UpdateGoalDto,
  ): Promise<GoalResponseDto> {
    const existingGoal = await this.progressRepository.findGoalById(goalId);
    if (!existingGoal) {
      throw new NotFoundException(`Goal with ID '${goalId}' not found`);
    }

    if (existingGoal.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this goal',
      );
    }

    const deadline =
      dto.deadline !== undefined
        ? dto.deadline
          ? new Date(dto.deadline)
          : null
        : undefined;

    const updatedGoal = await this.progressRepository.updateGoal(goalId, {
      targetValue: dto.targetValue,
      currentValue: dto.currentValue,
      deadline,
    });

    return this.toGoalResponseDto(updatedGoal);
  }

  async getProgressStats(userId: string): Promise<ProgressStatsResponseDto> {
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const endOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );

    return this.progressRepository.getMonthWorkoutStats(
      userId,
      startOfMonth,
      endOfMonth,
    );
  }

  calculateFromDate(range: WeightRangeFilter, now: Date = new Date()): Date {
    const fromDate = new Date(now);
    switch (range) {
      case WeightRangeFilter.SEVEN_DAYS:
        fromDate.setUTCDate(fromDate.getUTCDate() - 7);
        break;
      case WeightRangeFilter.THIRTY_DAYS:
        fromDate.setUTCDate(fromDate.getUTCDate() - 30);
        break;
      case WeightRangeFilter.THREE_MONTHS:
        fromDate.setUTCMonth(fromDate.getUTCMonth() - 3);
        break;
      case WeightRangeFilter.SIX_MONTHS:
        fromDate.setUTCMonth(fromDate.getUTCMonth() - 6);
        break;
      case WeightRangeFilter.ONE_YEAR:
        fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
        break;
      default:
        fromDate.setUTCDate(fromDate.getUTCDate() - 30);
    }
    fromDate.setUTCHours(0, 0, 0, 0);
    return fromDate;
  }

  private toWeightEntryResponseDto(entry: WeightEntry): WeightEntryResponseDto {
    return {
      id: entry.id,
      userId: entry.userId,
      date: entry.date.toISOString(),
      weightKg: entry.weightKg,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private toGoalResponseDto(goal: Goal): GoalResponseDto {
    return {
      id: goal.id,
      userId: goal.userId,
      type: goal.type,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
      createdAt: goal.createdAt.toISOString(),
    };
  }
}
