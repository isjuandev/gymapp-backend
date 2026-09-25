import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class UpdateUserEquipmentPreferencesDto {
  @ApiProperty({
    example: [
      '88888888-8888-4888-8888-888888888881',
      '88888888-8888-4888-8888-888888888882',
    ],
    description: 'Array of equipment UUIDs selected by the user',
  })
  @IsArray({ message: 'equipmentIds must be an array' })
  @IsUUID('4', {
    each: true,
    message: 'Each equipmentId must be a valid UUID v4',
  })
  equipmentIds: string[];
}
