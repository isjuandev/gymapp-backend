import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalType, Meal, MealEntry, MealType, Prisma } from '@prisma/client';
import {
  CreateMealDto,
  CreateMealEntryDto,
  DailyNutritionPlanResponseDto,
  MealEntryResponseDto,
  MealMacrosDto,
  MealResponseDto,
  NutritionTargetsResponseDto,
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

  async calculateTargets(
    userId: string,
    date: Date = new Date(),
  ): Promise<NutritionTargetsResponseDto> {
    const user = await this.nutritionRepository.findUserBiometrics(userId);
    if (!user) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    const latestWeight =
      user.weightEntries?.[0]?.weightKg ??
      user.onboardingProfile?.currentWeightKg ??
      75.0;

    const heightCm = user.heightCm ?? user.onboardingProfile?.heightCm ?? 175.0;
    const gender = (user.gender ?? user.onboardingProfile?.gender ?? 'MALE') as string;
    const goalType = (user.goalType ?? user.onboardingProfile?.goal ?? GoalType.LOSE_WEIGHT) as GoalType;

    const birthDate = user.birthDate ?? user.onboardingProfile?.birthDate;
    let age = 28;
    if (birthDate) {
      const now = new Date();
      age = now.getUTCFullYear() - new Date(birthDate).getUTCFullYear();
    }

    // 1. BMR (Mifflin-St Jeor)
    let bmr = 10 * latestWeight + 6.25 * heightCm - 5 * age;
    if (gender === 'FEMALE') {
      bmr -= 161;
    } else {
      bmr += 5;
    }
    bmr = Math.round(bmr);

    // 2. TDEE
    const daysPerWeek = user.onboardingProfile?.workoutDaysPerWeek ?? 4;
    let activityMultiplier = 1.45;
    if (daysPerWeek <= 2) activityMultiplier = 1.30;
    else if (daysPerWeek >= 5) activityMultiplier = 1.60;
    const tdee = Math.round(bmr * activityMultiplier);

    // 3. Goal adjustment
    let targetKcal = tdee;
    let proteinPerKg = 1.8;

    if (goalType === GoalType.LOSE_WEIGHT) {
      targetKcal = Math.round(tdee * 0.80); // 20% deficit
      proteinPerKg = 2.1;
      const minFloor = gender === 'FEMALE' ? 1200 : 1500;
      targetKcal = Math.max(minFloor, targetKcal);
    } else if (goalType === GoalType.GAIN_MUSCLE) {
      targetKcal = Math.round(tdee * 1.10); // 10% clean surplus
      proteinPerKg = 2.0;
    } else {
      targetKcal = Math.round(tdee);
      proteinPerKg = 1.6;
    }

    // 4. Macro breakdown
    const proteinGrams = Math.round(latestWeight * proteinPerKg);
    const fatGrams = Math.round((targetKcal * 0.25) / 9); // 25% fats
    let carbsGrams = Math.round((targetKcal - (proteinGrams * 4 + fatGrams * 9)) / 4);
    carbsGrams = Math.max(50, carbsGrams);

    // 5. Training Day Nutritional Cycling
    const isTrainingDay = await this.nutritionRepository.isDateTrainingDay(userId, date);
    let waterLiters = Math.round((latestWeight * 0.035) * 10) / 10;

    if (isTrainingDay) {
      const extraCarbs = Math.round(carbsGrams * 0.10);
      carbsGrams += extraCarbs;
      targetKcal += extraCarbs * 4;
      waterLiters = Math.round((waterLiters + 0.6) * 10) / 10;
    }

    return {
      bmr,
      tdee,
      targetKcal,
      proteinGrams,
      carbsGrams,
      fatGrams,
      waterLiters,
      isTrainingDay,
      goalType,
    };
  }

  async getDailyNutritionPlan(
    userId: string,
    dateString: string,
  ): Promise<DailyNutritionPlanResponseDto> {
    const rawDate = new Date(dateString);
    const date = new Date(
      Date.UTC(
        rawDate.getUTCFullYear(),
        rawDate.getUTCMonth(),
        rawDate.getUTCDate(),
      ),
    );

    // 1. Calculate targets for this specific date
    const targets = await this.calculateTargets(userId, date);

    // 2. Fetch logged entries for this date
    const startOfDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
    );
    const endOfDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
    );

    const loggedEntries = await this.nutritionRepository.findMealEntriesByDate(
      userId,
      startOfDay,
      endOfDay,
    );

    const consumedEntries = loggedEntries.filter((e) => e.consumed);
    const consumedKcal = consumedEntries.reduce((sum, e) => sum + e.meal.kcal, 0);

    const consumedMacros = consumedEntries.reduce(
      (acc, e) => {
        const m = e.meal.macros as unknown as MealMacrosDto;
        return {
          protein: acc.protein + Number(m?.protein ?? 0),
          carbs: acc.carbs + Number(m?.carbs ?? 0),
          fat: acc.fat + Number(m?.fat ?? 0),
        };
      },
      { protein: 0, carbs: 0, fat: 0 },
    );

    // 3. Recommended meals: fetch catalog meals
    const catalogMeals = await this.nutritionRepository.findMeals();

    return {
      date: date.toISOString(),
      targets,
      recommendedMeals: catalogMeals.map((m) => this.toMealResponseDto(m)),
      loggedEntries: loggedEntries.map((e) => this.toMealEntryResponseDto(e)),
      consumedKcal,
      consumedMacros,
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
