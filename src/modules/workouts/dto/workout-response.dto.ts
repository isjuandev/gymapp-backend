import { ApiProperty } from '@nestjs/swagger';
import { Workout } from '@prisma/client';

export class WorkoutResponseDto {
  @ApiProperty({
    example: '22222222-2222-2222-2222-222222222221',
    description: 'Unique workout UUID',
  })
  id: string;

  @ApiProperty({
    example: '11111111-1111-1111-1111-111111111111',
    description: 'Associated program UUID',
  })
  programId: string;

  @ApiProperty({
    example: 'Pecho & Tríceps Power',
    description: 'Workout title',
  })
  title: string;

  @ApiProperty({
    example: 50,
    description: 'Estimated duration in minutes',
  })
  durationMinutes: number;

  @ApiProperty({
    example: 'Intermedio',
    description: 'Difficulty level description',
  })
  difficulty: string;

  @ApiProperty({
    example: 420,
    description: 'Estimated calories burned',
  })
  kcalEstimate: number;

  @ApiProperty({
    example: 'workout_chest_triceps',
    description: 'Image asset name in the iOS bundle',
  })
  imageAssetName: string;

  @ApiProperty({
    example: 4,
    description: 'Number of workout rounds / circuits',
  })
  rounds: number;

  static fromEntity(workout: Workout): WorkoutResponseDto {
    return {
      id: workout.id,
      programId: workout.programId,
      title: workout.title,
      durationMinutes: workout.durationMinutes,
      difficulty: workout.difficulty,
      kcalEstimate: workout.kcalEstimate,
      imageAssetName: workout.imageAssetName,
      rounds: workout.rounds,
    };
  }
}
