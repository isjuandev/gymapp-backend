import { Injectable, NotFoundException } from '@nestjs/common';
import { Meal, MealEntry, MealType, Prisma } from '@prisma/client';
import {
  CreateMealDto,
  CreateMealEntryDto,
  MealEntryResponseDto,
  MealMacrosDto,
  MealResponseDto,
  TodaySummaryResponseDto,
  UpdateMealDto,
} from './dto';
import { NutritionRepository } from './repositories/nutrition.repository';

@Injectable()
export class NutritionService {
  constructor(private readonly nutritionRepository: NutritionRepository) {}

  async getMeals(type?: MealType): Promise<MealResponseDto[]> {
    const meals = await this.nutritionRepository.findMeals(type);
    return meals.map((m) => this.toMealResponseDto(m));
  }

  async getMealById(id: string): Promise<MealResponseDto> {
    const meal = await this.nutritionRepository.findMealById(id);
    if (!meal) {
      throw new NotFoundException(`Meal with ID '${id}' not found`);
    }
    return this.toMealResponseDto(meal);
  }

  async createMeal(dto: CreateMealDto): Promise<MealResponseDto> {
    const meal = await this.nutritionRepository.createMeal({
      name: dto.name,
      kcal: dto.kcal,
      macros: dto.macros as unknown as Prisma.InputJsonValue,
      type: dto.type,
      imageAssetName: dto.imageAssetName,
    });
    return this.toMealResponseDto(meal);
  }

  async updateMeal(id: string, dto: UpdateMealDto): Promise<MealResponseDto> {
    const existing = await this.nutritionRepository.findMealById(id);
    if (!existing) {
      throw new NotFoundException(`Meal with ID '${id}' not found`);
    }

    const updated = await this.nutritionRepository.updateMeal(id, {
      name: dto.name,
      kcal: dto.kcal,
      macros: dto.macros
        ? (dto.macros as unknown as Prisma.InputJsonValue)
        : undefined,
      type: dto.type,
      imageAssetName: dto.imageAssetName,
    });

    return this.toMealResponseDto(updated);
  }

  async deleteMeal(id: string): Promise<void> {
    const existing = await this.nutritionRepository.findMealById(id);
    if (!existing) {
      throw new NotFoundException(`Meal with ID '${id}' not found`);
    }
    await this.nutritionRepository.deleteMeal(id);
  }

  async upsertMealEntry(
    userId: string,
    dto: CreateMealEntryDto,
  ): Promise<MealEntryResponseDto> {
    const meal = await this.nutritionRepository.findMealById(dto.mealId);
    if (!meal) {
      throw new NotFoundException(`Meal with ID '${dto.mealId}' not found`);
    }

    const rawDate = new Date(dto.date);
    const normalizedDate = new Date(
      Date.UTC(
        rawDate.getUTCFullYear(),
        rawDate.getUTCMonth(),
        rawDate.getUTCDate(),
      ),
    );

    const entry = await this.nutritionRepository.upsertMealEntry(
      userId,
      dto.mealId,
      normalizedDate,
      dto.consumed,
    );

    return this.toMealEntryResponseDto(entry);
  }

  async getMealEntriesByDate(
    userId: string,
    dateString: string,
  ): Promise<MealEntryResponseDto[]> {
    const d = new Date(dateString);
    const startOfDay = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
    );
    const endOfDay = new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const entries = await this.nutritionRepository.findMealEntriesByDate(
      userId,
      startOfDay,
      endOfDay,
    );

    return entries.map((entry) => this.toMealEntryResponseDto(entry));
  }

  async getTodaySummary(userId: string): Promise<TodaySummaryResponseDto> {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const entries = await this.nutritionRepository.findMealEntriesByDate(
      userId,
      startOfDay,
      endOfDay,
    );

    const totalKcal = entries.reduce((sum, e) => sum + e.meal.kcal, 0);

    return {
      totalKcal,
      entries: entries.map((entry) => this.toMealEntryResponseDto(entry)),
    };
  }

  private toMealResponseDto(meal: Meal): MealResponseDto {
    const macros = meal.macros as unknown as MealMacrosDto;
    return {
      id: meal.id,
      name: meal.name,
      kcal: meal.kcal,
      macros: {
        protein: Number(macros?.protein ?? 0),
        carbs: Number(macros?.carbs ?? 0),
        fat: Number(macros?.fat ?? 0),
      },
      type: meal.type,
      imageAssetName: meal.imageAssetName,
    };
  }

  private toMealEntryResponseDto(
    entry: MealEntry & { meal: Meal },
  ): MealEntryResponseDto {
    return {
      id: entry.id,
      userId: entry.userId,
      mealId: entry.mealId,
      date: entry.date.toISOString(),
      consumed: entry.consumed,
      meal: this.toMealResponseDto(entry.meal),
    };
  }
}
