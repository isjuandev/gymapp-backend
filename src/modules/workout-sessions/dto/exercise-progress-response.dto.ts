import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExerciseProgressResponseDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  exerciseId: string;

  @ApiProperty({ example: 'Press de Banca Plano' })
  exerciseName: string;

  @ApiProperty({ example: 40.0 })
  currentWorkingWeightKg: number;

  @ApiProperty({
    example: 2,
    description:
      'Number of consecutive sessions where all working sets hit the top of the rep range',
  })
  consecutiveSessionsAtTarget: number;

  @ApiProperty({
    example: true,
    description:
      'True if the user has completed at least 2 consecutive sessions at target, mastering this weight',
  })
  isMastered: boolean;

  @ApiPropertyOptional({
    example: 42.5,
    description:
      'Suggested weight for the next session based on equipment increment, null if not yet mastered',
  })
  suggestedNextWeightKg: number | null;

  @ApiProperty({ example: 8 })
  targetMinReps: number;

  @ApiProperty({ example: 12 })
  targetMaxReps: number;

  @ApiProperty({ example: 2.5 })
  incrementKg: number;

  @ApiPropertyOptional({ example: 'Barra Olímpica Estándar' })
  equipmentName: string | null;

  @ApiPropertyOptional({ example: '2026-09-25T14:30:00.000Z' })
  lastSessionDate: Date | null;
}
