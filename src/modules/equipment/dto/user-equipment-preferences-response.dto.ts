import { ApiProperty } from '@nestjs/swagger';

export class UserEquipmentPreferencesResponseDto {
  @ApiProperty({
    example: [
      '88888888-8888-4888-8888-888888888881',
      '88888888-8888-4888-8888-888888888882',
    ],
    description: 'Array of equipment IDs selected by the user',
  })
  equipmentIds: string[];
}
