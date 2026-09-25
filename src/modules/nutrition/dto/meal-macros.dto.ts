import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class MealMacrosDto {
  @ApiProperty({ example: 35.0, description: 'Protein content in grams' })
  @IsNumber({}, { message: 'protein must be a number' })
  @Min(0, { message: 'protein must be greater than or equal to 0' })
  protein: number;

  @ApiProperty({ example: 45.0, description: 'Carbohydrates content in grams' })
  @IsNumber({}, { message: 'carbs must be a number' })
  @Min(0, { message: 'carbs must be greater than or equal to 0' })
  carbs: number;

  @ApiProperty({ example: 12.0, description: 'Fat content in grams' })
  @IsNumber({}, { message: 'fat must be a number' })
  @Min(0, { message: 'fat must be greater than or equal to 0' })
  fat: number;
}
