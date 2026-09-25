import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MealType } from '@prisma/client';
import { MealMacrosDto } from './meal-macros.dto';

export class UpdateMealDto {
  @ApiPropertyOptional({
    example: 'Avocado Toast with Poached Eggs & Salmon',
    description: 'Name of the meal dish',
  })
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  name?: string;

  @ApiPropertyOptional({
    example: 480,
    description: 'Total energy in kilocalories',
  })
  @IsOptional()
  @IsInt({ message: 'kcal must be an integer' })
  @Min(0, { message: 'kcal must be greater than or equal to 0' })
  kcal?: number;

  @ApiPropertyOptional({
    type: MealMacrosDto,
    description: 'Macronutrient breakdown (protein, carbs, fat in grams)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MealMacrosDto)
  macros?: MealMacrosDto;

  @ApiPropertyOptional({
    enum: MealType,
    example: MealType.BREAKFAST,
    description: 'Meal classification type (BREAKFAST, LUNCH, DINNER, SNACK)',
  })
  @IsOptional()
  @IsEnum(MealType, {
    message: 'type must be BREAKFAST, LUNCH, DINNER, or SNACK',
  })
  type?: MealType;

  @ApiPropertyOptional({
    example: 'avocado_toast_salmon',
    description: 'Image asset identifier in Swift client bundle',
  })
  @IsOptional()
  @IsString({ message: 'imageAssetName must be a string' })
  imageAssetName?: string;
}
