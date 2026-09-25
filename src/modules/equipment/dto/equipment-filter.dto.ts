import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EquipmentCategory } from '@prisma/client';

export class EquipmentFilterDto {
  @ApiPropertyOptional({
    enum: EquipmentCategory,
    example: EquipmentCategory.STRENGTH,
    description:
      'Filter available equipment by category (CARDIO, STRENGTH, FREE_WEIGHTS, BODYWEIGHT, ACCESSORY)',
  })
  @IsOptional()
  @IsEnum(EquipmentCategory, {
    message:
      'category must be one of: CARDIO, STRENGTH, FREE_WEIGHTS, BODYWEIGHT, ACCESSORY',
  })
  category?: EquipmentCategory;
}
