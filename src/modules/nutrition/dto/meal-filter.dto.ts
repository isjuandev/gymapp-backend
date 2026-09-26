import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'Reference date in ISO8601 format',
    example: '2026-09-26T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  date?: string;
}
