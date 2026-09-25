import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Meal, MealEntry, MealType, Prisma } from '@prisma/client';

export interface CreateMealData {
  name: string;
  kcal: number;
  macros: Prisma.InputJsonValue;
  type: MealType;
  imageAssetName: string;
}

export interface UpdateMealData {
  name?: string;
  kcal?: number;
  macros?: Prisma.InputJsonValue;
  type?: MealType;
  imageAssetName?: string;
}

@Injectable()
export class NutritionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMeals(type?: MealType): Promise<Meal[]> {
    return this.prisma.meal.findMany({
      where: {
        ...(type ? { type } : {}),
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findMealById(id: string): Promise<Meal | null> {
    return this.prisma.meal.findUnique({
      where: { id },
    });
  }

  async createMeal(data: CreateMealData): Promise<Meal> {
    return this.prisma.meal.create({
      data: {
        name: data.name,
        kcal: data.kcal,
        macros: data.macros,
        type: data.type,
        imageAssetName: data.imageAssetName,
      },
    });
  }

  async updateMeal(id: string, data: UpdateMealData): Promise<Meal> {
    return this.prisma.meal.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.kcal !== undefined ? { kcal: data.kcal } : {}),
        ...(data.macros !== undefined ? { macros: data.macros } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.imageAssetName !== undefined
          ? { imageAssetName: data.imageAssetName }
          : {}),
      },
    });
  }

  async deleteMeal(id: string): Promise<Meal> {
    return this.prisma.meal.delete({
      where: { id },
    });
  }

  async upsertMealEntry(
    userId: string,
    mealId: string,
    date: Date,
    consumed: boolean,
  ): Promise<MealEntry & { meal: Meal }> {
    return this.prisma.mealEntry.upsert({
      where: {
        userId_mealId_date: {
          userId,
          mealId,
          date,
        },
      },
      update: {
        consumed,
      },
      create: {
        userId,
        mealId,
        date,
        consumed,
      },
      include: {
        meal: true,
      },
    });
  }

  async findMealEntriesByDate(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<(MealEntry & { meal: Meal })[]> {
    return this.prisma.mealEntry.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        meal: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }
}
