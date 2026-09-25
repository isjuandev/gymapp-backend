import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MuscleGroup, EquipmentCategory } from '@prisma/client';

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Search by exercise name, target muscle or keyword',
    example: 'bench press',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: MuscleGroup,
    description: 'Filter by primary muscle group',
    example: MuscleGroup.CHEST,
  })
  @IsOptional()
  @IsEnum(MuscleGroup)
  muscleGroup?: MuscleGroup;

  @ApiPropertyOptional({
    enum: EquipmentCategory,
    description: 'Filter by equipment category',
    example: EquipmentCategory.FREE_WEIGHTS,
  })
  @IsOptional()
  @IsEnum(EquipmentCategory)
  equipmentCategory?: EquipmentCategory;

  @ApiPropertyOptional({
    description: 'Filter by specific equipment ID',
  })
  @IsOptional()
  @IsString()
  equipmentId?: string;

  @ApiPropertyOptional({
    description: 'Limit results (default 50, max 100)',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @ApiPropertyOptional({
    description: 'Offset for pagination (default 0)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
