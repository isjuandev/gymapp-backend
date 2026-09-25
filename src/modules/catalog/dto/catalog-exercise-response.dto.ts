import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentCategory, MuscleGroup, WeightType } from '@prisma/client';

export class CatalogEquipmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: EquipmentCategory })
  category: EquipmentCategory;

  @ApiProperty({ enum: WeightType })
  weightType: WeightType;

  @ApiProperty()
  incrementKg: number;

  @ApiProperty()
  minWeightKg: number;

  @ApiProperty()
  maxWeightKg: number;
}

export class CatalogExerciseResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  externalId?: string | null;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  nameEs?: string | null;

  @ApiPropertyOptional()
  videoUrl?: string | null;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiProperty({ type: [String] })
  instructions: string[];

  @ApiProperty({ type: [String] })
  exerciseTips: string[];

  @ApiProperty({ enum: MuscleGroup })
  primaryMuscleGroup: MuscleGroup;

  @ApiProperty({ type: [String] })
  targetMuscles: string[];

  @ApiProperty({ type: [String] })
  secondaryMuscles: string[];

  @ApiProperty({ enum: EquipmentCategory })
  equipmentCategory: EquipmentCategory;

  @ApiPropertyOptional()
  equipmentName?: string | null;

  @ApiProperty()
  suggestedMinReps: number;

  @ApiProperty()
  suggestedMaxReps: number;

  @ApiProperty()
  defaultRestSeconds: number;

  @ApiPropertyOptional()
  equipmentId?: string | null;

  @ApiPropertyOptional({ type: CatalogEquipmentDto })
  equipment?: CatalogEquipmentDto | null;
}

export class CatalogListResponseDto {
  @ApiProperty({ type: [CatalogExerciseResponseDto] })
  items: CatalogExerciseResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}
