import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MealType } from '@prisma/client';
import { MealMacrosDto } from './meal-macros.dto';

export class CreateMealDto {
  @ApiProperty({
    example: 'Avocado Toast with Poached Eggs',
    description: 'Name of the meal dish',
  })
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @ApiProperty({
    example: 420,
    description: 'Total energy in kilocalories',
  })
  @IsInt({ message: 'kcal must be an integer' })
  @Min(0, { message: 'kcal must be greater than or equal to 0' })
  kcal: number;

  @ApiProperty({
    type: MealMacrosDto,
    description: 'Macronutrient breakdown (protein, carbs, fat in grams)',
  })
  @ValidateNested()
  @Type(() => MealMacrosDto)
  macros: MealMacrosDto;

  @ApiProperty({
    enum: MealType,
    example: MealType.BREAKFAST,
    description: 'Meal classification type (BREAKFAST, LUNCH, DINNER, SNACK)',
  })
  @IsEnum(MealType, {
    message: 'type must be BREAKFAST, LUNCH, DINNER, or SNACK',
  })
  @IsNotEmpty({ message: 'type is required' })
  type: MealType;

  @ApiProperty({
    example: 'avocado_toast',
    description: 'Image asset identifier in Swift client bundle',
  })
  @IsString({ message: 'imageAssetName must be a string' })
  @IsNotEmpty({ message: 'imageAssetName is required' })
  imageAssetName: string;
}
