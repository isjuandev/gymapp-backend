import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PersonalRecordDto {
  @ApiProperty({ example: 24.0, description: 'Weight in kg' })
  weightKg: number;

  @ApiProperty({ example: 7, description: 'Repetitions performed' })
  reps: number;

  @ApiProperty({ example: '2026-09-20', description: 'ISO date string when PR was achieved' })
  date: string;

  @ApiProperty({ example: 29.6, description: 'Estimated 1RM using Epley formula' })
  estimated1RM: number;
}

export class ExerciseSessionHistoryItemDto {
  @ApiProperty({ example: '2026-09-20', description: 'ISO date string' })
  date: string;

  @ApiProperty({ example: 24.0, description: 'Best working weight lifted in this session' })
  bestWeightKg: number;

  @ApiProperty({ example: 7, description: 'Reps completed at best weight' })
  bestReps: number;

  @ApiProperty({ example: true, description: 'True if this session represents a PR' })
  isPR: boolean;

  @ApiProperty({ example: 29.6, description: 'Estimated 1RM for best set' })
  estimated1RM: number;

  @ApiProperty({ example: 4, description: 'Total working sets completed in this session' })
  totalSets: number;
}

export class ExerciseHistoryResponseDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  exerciseId: string;

  @ApiProperty({ example: 'Press Banca Inclinado con Mancuernas' })
  exerciseName: string;

  @ApiPropertyOptional({ example: 'Ajustar banco a 30 grados.' })
  userNotes: string | null;

  @ApiPropertyOptional({ type: () => PersonalRecordDto })
  personalRecord: PersonalRecordDto | null;

  @ApiProperty({ type: () => [ExerciseSessionHistoryItemDto] })
  history: ExerciseSessionHistoryItemDto[];
}
