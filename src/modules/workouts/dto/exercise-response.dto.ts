import { ApiProperty } from '@nestjs/swagger';
import { Exercise, MuscleGroup } from '@prisma/client';
import { ExerciseKindDto } from './create-exercise.dto';
import { ResolvedExercise } from '../../recommendation/recommendation.service';

export class ExerciseResponseDto {
  @ApiProperty({
    example: '33333333-3333-3333-3333-333333333331',
    description: 'Unique exercise UUID',
  })
  id: string;

  @ApiProperty({
    example: '22222222-2222-2222-2222-222222222221',
    description: 'Parent workout UUID',
  })
  workoutId: string;

  @ApiProperty({
    example: 'Press de Banca Plano con Barra',
    description: 'Exercise name',
  })
  name: string;

  @ApiProperty({
    example: 1,
    description: 'Sequence order of the exercise',
  })
  order: number;

  @ApiProperty({
    type: () => ExerciseKindDto,
    example: { type: 'reps', count: 10 },
    description: 'Kind object containing reps or duration',
  })
  kind: { type: 'reps'; count: number } | { type: 'duration'; seconds: number };

  @ApiProperty({
    example: 'ex_bench_press',
    description: 'Asset name in iOS client bundle',
  })
  imageAssetName: string;

  @ApiProperty({
    enum: MuscleGroup,
    example: MuscleGroup.CHEST,
    description: 'Primary muscle group targeted by this exercise',
    required: false,
  })
  primaryMuscleGroup?: MuscleGroup;

  @ApiProperty({
    example: '88888888-8888-4888-8888-888888888881',
    description: 'Required equipment UUID, or null if bodyweight',
    nullable: true,
    required: false,
  })
  requiredEquipmentId?: string | null;

  @ApiProperty({
    example: 'sub_group_chest_press',
    description: 'Substitution group ID for interchangeable exercise variants',
    nullable: true,
    required: false,
  })
  substitutionGroupId?: string | null;

  @ApiProperty({
    example: false,
    description: 'Whether this exercise was dynamically substituted',
    required: false,
  })
  wasSubstituted?: boolean;

  @ApiProperty({
    example: null,
    description: 'Original exercise UUID before substitution, if substituted',
    nullable: true,
    required: false,
  })
  originalExerciseId?: string | null;

  @ApiProperty({
    example: false,
    description:
      'Whether the exercise has no available equipment or substitute',
    required: false,
  })
  noEquipmentAvailable?: boolean;

  static fromEntity(
    exercise: Exercise,
    substitutionInfo?: {
      wasSubstituted?: boolean;
      originalExerciseId?: string | null;
      noEquipmentAvailable?: boolean;
    },
  ): ExerciseResponseDto {
    return {
      id: exercise.id,
      workoutId: exercise.workoutId,
      name: exercise.name,
      order: exercise.order,
      kind: exercise.kind as
        { type: 'reps'; count: number } | { type: 'duration'; seconds: number },
      imageAssetName: exercise.imageAssetName,
      primaryMuscleGroup: exercise.primaryMuscleGroup,
      requiredEquipmentId: exercise.requiredEquipmentId ?? null,
      substitutionGroupId: exercise.substitutionGroupId ?? null,
      wasSubstituted: substitutionInfo?.wasSubstituted ?? false,
      originalExerciseId: substitutionInfo?.originalExerciseId ?? null,
      noEquipmentAvailable: substitutionInfo?.noEquipmentAvailable ?? false,
    };
  }

  static fromResolved(
    resolved: ResolvedExercise,
    workoutId: string,
  ): ExerciseResponseDto {
    return {
      id: resolved.id,
      workoutId,
      name: resolved.name,
      order: resolved.order,
      kind: resolved.kind,
      imageAssetName: resolved.imageAssetName,
      primaryMuscleGroup: resolved.primaryMuscleGroup,
      requiredEquipmentId: resolved.requiredEquipmentId,
      substitutionGroupId: resolved.substitutionGroupId,
      wasSubstituted: resolved.wasSubstituted,
      originalExerciseId: resolved.originalExerciseId ?? null,
      noEquipmentAvailable: resolved.noEquipmentAvailable,
    };
  }
}
