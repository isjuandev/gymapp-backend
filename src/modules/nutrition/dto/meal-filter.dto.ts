import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { MealType } from '@prisma/client';

export class MealFilterDto {
  @ApiPropertyOptional({
    enum: MealType,
    example: MealType.BREAKFAST,
    description:
      'Filter catalog meals by type (BREAKFAST, LUNCH, DINNER, SNACK)',
  })
  @IsOptional()
  @IsEnum(MealType, {
    message: 'type must be BREAKFAST, LUNCH, DINNER, or SNACK',
  })
  type?: MealType;
}
