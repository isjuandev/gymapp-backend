import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateExerciseNotesDto {
  @ApiProperty({
    example: 'Ajustar banco a 30 grados, agarre ligeramente más ancho que los hombros.',
    description: 'Personal notes and technique cues for this exercise',
  })
  @IsString()
  @MaxLength(1000)
  notes: string;
}
