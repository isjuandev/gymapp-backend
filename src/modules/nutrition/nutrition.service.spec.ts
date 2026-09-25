import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NutritionService } from './nutrition.service';
import { NutritionRepository } from './repositories/nutrition.repository';
import { MealType } from '@prisma/client';

describe('NutritionService', () => {
  let service: NutritionService;
  let repository: jest.Mocked<NutritionRepository>;

  const userId = 'user-uuid-1111';
  const mealId = 'meal-uuid-2222';

  const mockMeal = {
    id: mealId,
    name: 'Protein Oatmeal',
    kcal: 350,
    macros: { protein: 25, carbs: 45, fat: 8 },
    type: MealType.BREAKFAST,
    imageAssetName: 'oatmeal',
  };

  const mockEntry = {
    id: 'entry-uuid-3333',
    userId,
    mealId,
    date: new Date('2026-09-24T00:00:00.000Z'),
    consumed: true,
    meal: mockMeal,
  };

  beforeEach(async () => {
    const mockRepo = {
      findMeals: jest.fn(),
      findMealById: jest.fn(),
      createMeal: jest.fn(),
      updateMeal: jest.fn(),
      deleteMeal: jest.fn(),
      upsertMealEntry: jest.fn(),
      findMealEntriesByDate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionService,
        { provide: NutritionRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<NutritionService>(NutritionService);
    repository = module.get(NutritionRepository);
  });

  describe('getMeals', () => {
    it('should return mapped meals array', async () => {
      repository.findMeals.mockResolvedValue([mockMeal]);

      const result = await service.getMeals(MealType.BREAKFAST);

      expect(repository.findMeals).toHaveBeenCalledWith(MealType.BREAKFAST);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Protein Oatmeal');
      expect(result[0].macros).toEqual({ protein: 25, carbs: 45, fat: 8 });
    });
  });

  describe('getMealById', () => {
    it('should return meal when found', async () => {
      repository.findMealById.mockResolvedValue(mockMeal);

      const result = await service.getMealById(mealId);

      expect(result.id).toBe(mealId);
    });

    it('should throw NotFoundException when meal does not exist', async () => {
      repository.findMealById.mockResolvedValue(null);

      await expect(service.getMealById('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createMeal', () => {
    it('should create and return meal', async () => {
      repository.createMeal.mockResolvedValue(mockMeal);

      const result = await service.createMeal({
        name: 'Protein Oatmeal',
        kcal: 350,
        macros: { protein: 25, carbs: 45, fat: 8 },
        type: MealType.BREAKFAST,
        imageAssetName: 'oatmeal',
      });

      expect(repository.createMeal).toHaveBeenCalledWith({
        name: 'Protein Oatmeal',
        kcal: 350,
        macros: { protein: 25, carbs: 45, fat: 8 },
        type: MealType.BREAKFAST,
        imageAssetName: 'oatmeal',
      });
      expect(result.name).toBe('Protein Oatmeal');
    });
  });

  describe('updateMeal', () => {
    it('should throw NotFoundException if meal does not exist', async () => {
      repository.findMealById.mockResolvedValue(null);

      await expect(
        service.updateMeal('unknown', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update meal when found', async () => {
      repository.findMealById.mockResolvedValue(mockMeal);
      repository.updateMeal.mockResolvedValue({
        ...mockMeal,
        name: 'Updated Oatmeal',
      });

      const result = await service.updateMeal(mealId, {
        name: 'Updated Oatmeal',
      });

      expect(repository.updateMeal).toHaveBeenCalled();
      expect(result.name).toBe('Updated Oatmeal');
    });
  });

  describe('deleteMeal', () => {
    it('should throw NotFoundException if meal does not exist', async () => {
      repository.findMealById.mockResolvedValue(null);

      await expect(service.deleteMeal('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete meal when found', async () => {
      repository.findMealById.mockResolvedValue(mockMeal);
      repository.deleteMeal.mockResolvedValue(mockMeal);

      await service.deleteMeal(mealId);

      expect(repository.deleteMeal).toHaveBeenCalledWith(mealId);
    });
  });

  describe('upsertMealEntry', () => {
    it('should throw NotFoundException if meal does not exist', async () => {
      repository.findMealById.mockResolvedValue(null);

      await expect(
        service.upsertMealEntry(userId, {
          mealId: 'unknown',
          date: '2026-09-24',
          consumed: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should normalize date to start of UTC day and upsert entry', async () => {
      repository.findMealById.mockResolvedValue(mockMeal);
      repository.upsertMealEntry.mockResolvedValue(mockEntry);

      const result = await service.upsertMealEntry(userId, {
        mealId,
        date: '2026-09-24T18:00:00.000Z',
        consumed: true,
      });

      expect(repository.upsertMealEntry).toHaveBeenCalledWith(
        userId,
        mealId,
        new Date(Date.UTC(2026, 8, 24, 0, 0, 0, 0)),
        true,
      );
      expect(result.id).toBe(mockEntry.id);
      expect(result.consumed).toBe(true);
      expect(result.meal.name).toBe(mockMeal.name);
    });
  });

  describe('getMealEntriesByDate', () => {
    it('should query entries for that calendar day', async () => {
      repository.findMealEntriesByDate.mockResolvedValue([mockEntry]);

      const result = await service.getMealEntriesByDate(userId, '2026-09-24');

      expect(repository.findMealEntriesByDate).toHaveBeenCalledWith(
        userId,
        new Date(Date.UTC(2026, 8, 24, 0, 0, 0, 0)),
        new Date(Date.UTC(2026, 8, 24, 23, 59, 59, 999)),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getTodaySummary', () => {
    it('should calculate totalKcal across today entries and return summary', async () => {
      const entry2 = {
        ...mockEntry,
        id: 'entry-uuid-2',
        meal: {
          ...mockMeal,
          id: 'meal-2',
          kcal: 500,
        },
      };

      repository.findMealEntriesByDate.mockResolvedValue([mockEntry, entry2]);

      const result = await service.getTodaySummary(userId);

      expect(result.totalKcal).toBe(850); // 350 + 500
      expect(result.entries).toHaveLength(2);
    });
  });
});
