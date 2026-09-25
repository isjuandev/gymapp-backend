import { ApiProperty } from '@nestjs/swagger';
import { EquipmentCategory } from '@prisma/client';

export class EquipmentResponseDto {
  @ApiProperty({
    example: '88888888-8888-4888-8888-888888888881',
    description: 'Unique identifier for the equipment',
  })
  id: string;

  @ApiProperty({
    example: 'Barra Olímpica y Banco Plano',
    description: 'Equipment name',
  })
  name: string;

  @ApiProperty({
    enum: EquipmentCategory,
    example: EquipmentCategory.FREE_WEIGHTS,
    description: 'Equipment category classification',
  })
  category: EquipmentCategory;

  @ApiProperty({
    example: 'eq_barbell_bench',
    description: 'Asset identifier for iOS app bundle',
  })
  imageAssetName: string;

  @ApiProperty({
    example: true,
    description: 'Whether this equipment is available at the gym',
  })
  isAvailableAtGym: boolean;
}
