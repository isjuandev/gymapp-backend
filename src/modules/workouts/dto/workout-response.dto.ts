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
    description: 'Associated program UUID (null for user custom workouts)',
    required: false,
    nullable: true,
  })
  programId: string | null;

  @ApiProperty({
    example: 'user-uuid-here',
    description: 'Owner user UUID (null for catalog workouts)',
    required: false,
    nullable: true,
  })
  ownerUserId?: string | null;

  @ApiProperty({
    example: false,
    description: 'True if this is a user-created custom workout',
  })
  isCustom: boolean;

  @ApiProperty({
    example: 'Pecho & Tríceps Power',
    description: 'Workout title',
  })
  title: string;

  @ApiProperty({
    example: 50,
    description: 'Estimated duration in minutes',
    required: false,
    nullable: true,
  })
  durationMinutes: number | null;

  @ApiProperty({
    example: 'Intermedio',
    description: 'Difficulty level description',
    required: false,
    nullable: true,
  })
  difficulty: string | null;

  @ApiProperty({
    example: 420,
    description: 'Estimated calories burned',
    required: false,
    nullable: true,
  })
  kcalEstimate: number | null;

  @ApiProperty({
    example: 'workout_chest_triceps',
    description: 'Image asset name in the iOS bundle',
    required: false,
    nullable: true,
  })
  imageAssetName: string | null;

  @ApiProperty({
    example: 4,
    description: 'Number of workout rounds / circuits',
  })
  rounds: number;

  static fromEntity(workout: Workout): WorkoutResponseDto {
    return {
      id: workout.id,
      programId: workout.programId,
      ownerUserId: workout.ownerUserId,
      isCustom: !!workout.ownerUserId,
      title: workout.title,
      durationMinutes: workout.durationMinutes,
      difficulty: workout.difficulty,
      kcalEstimate: workout.kcalEstimate,
      imageAssetName: workout.imageAssetName,
      rounds: workout.rounds,
    };
  }
}
