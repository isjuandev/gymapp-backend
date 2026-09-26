import { ApiProperty } from '@nestjs/swagger';
import { GoalType } from '@prisma/client';

export class NutritionTargetsResponseDto {
  @ApiProperty({ example: 1650, description: 'Basal Metabolic Rate (BMR) in kcal' })
  bmr: number;

  @ApiProperty({ example: 2310, description: 'Total Daily Energy Expenditure (TDEE) in kcal' })
  tdee: number;

  @ApiProperty({ example: 1850, description: 'Target daily kilocalories adjusted for goal and training day' })
  targetKcal: number;

  @ApiProperty({ example: 140, description: 'Daily target protein in grams' })
  proteinGrams: number;

  @ApiProperty({ example: 185, description: 'Daily target carbohydrates in grams' })
  carbsGrams: number;

  @ApiProperty({ example: 60, description: 'Daily target fat in grams' })
  fatGrams: number;

  @ApiProperty({ example: 2.5, description: 'Daily hydration target in liters' })
  waterLiters: number;

  @ApiProperty({ example: true, description: 'Whether the requested date is a scheduled training day' })
  isTrainingDay: boolean;

  @ApiProperty({ enum: GoalType, example: GoalType.LOSE_WEIGHT, description: 'Active fitness goal applied' })
  goalType: GoalType;
}
