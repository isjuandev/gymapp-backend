import { ApiProperty } from '@nestjs/swagger';
import { NutritionTargetsResponseDto } from './nutrition-targets-response.dto';
import { MealResponseDto } from './meal-response.dto';
import { MealEntryResponseDto } from './meal-entry-response.dto';

export class ConsumedMacrosDto {
  @ApiProperty({ example: 80, description: 'Consumed protein in grams' })
  protein: number;

  @ApiProperty({ example: 109, description: 'Consumed carbohydrates in grams' })
  carbs: number;

  @ApiProperty({ example: 34, description: 'Consumed fat in grams' })
  fat: number;
}

export class DailyNutritionPlanResponseDto {
  @ApiProperty({ example: '2026-09-26T00:00:00.000Z', description: 'ISO date of the daily plan' })
  date: string;

  @ApiProperty({ type: NutritionTargetsResponseDto, description: 'Calculated nutritional targets for the day' })
  targets: NutritionTargetsResponseDto;

  @ApiProperty({ type: [MealResponseDto], description: 'Recommended meals for the day from catalog matching targets' })
  recommendedMeals: MealResponseDto[];

  @ApiProperty({ type: [MealEntryResponseDto], description: 'User-logged meal consumption entries for this date' })
  loggedEntries: MealEntryResponseDto[];

  @ApiProperty({ example: 1070, description: 'Total kcal consumed so far today' })
  consumedKcal: number;

  @ApiProperty({ type: ConsumedMacrosDto, description: 'Macros consumed so far today' })
  consumedMacros: ConsumedMacrosDto;
}
