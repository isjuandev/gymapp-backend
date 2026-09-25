import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEquipmentAvailabilityDto {
  @ApiPropertyOptional({
    example: false,
    description:
      'Set availability explicitly, or omit/leave undefined to toggle current availability',
  })
  @IsOptional()
  @IsBoolean({ message: 'isAvailableAtGym must be a boolean' })
  isAvailableAtGym?: boolean;
}
