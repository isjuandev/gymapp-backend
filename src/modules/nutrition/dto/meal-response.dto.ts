import { ApiProperty } from '@nestjs/swagger';
import { MealType } from '@prisma/client';
import { MealMacrosDto } from './meal-macros.dto';

export class MealResponseDto {
  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Unique identifier for the meal',
  })
  id: string;

  @ApiProperty({
    example: 'Avocado Toast with Poached Eggs',
    description: 'Name of the meal dish',
  })
  name: string;

  @ApiProperty({
    example: 420,
    description: 'Energy in kilocalories',
  })
  kcal: number;

  @ApiProperty({
    type: MealMacrosDto,
    description: 'Macronutrients breakdown',
  })
  macros: MealMacrosDto;

  @ApiProperty({
    enum: MealType,
    example: MealType.BREAKFAST,
    description: 'Meal type category',
  })
  type: MealType;

  @ApiProperty({
    example: 'avocado_toast',
    description: 'Asset name in iOS client',
  })
  imageAssetName: string;
}
