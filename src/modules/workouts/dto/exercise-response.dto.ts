import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ example: 8 })
  minReps?: number;

  @ApiPropertyOptional({ example: 12 })
  maxReps?: number;

  @ApiPropertyOptional({ example: 3 })
  defaultSets?: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Suggested working sets tailored to user goal',
  })
  suggestedSets?: number;

  @ApiPropertyOptional({ example: 8 })
  suggestedMinReps?: number;

  @ApiPropertyOptional({ example: 12 })
  suggestedMaxReps?: number;

  @ApiPropertyOptional({
    example: 20.0,
    description: 'Suggested working weight in kg tailored to user level and equipment',
  })
  suggestedWeightKg?: number;

  @ApiPropertyOptional({
    example: '20->24 kg',
    description: 'Display string for weight progression or baseline',
  })
  suggestedWeightLabel?: string;

  @ApiPropertyOptional({ example: 90 })
  restSeconds?: number;

  @ApiPropertyOptional({ example: ['Mantén la espalda apoyada', 'Baja controlando el peso'] })
  instructions?: string[];

  @ApiPropertyOptional({ example: 'https://cdn.exercisedb.dev/videos/bench_press.mp4' })
  videoUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.exercisedb.dev/images/bench_press.jpg' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 'Ajustar banco a 30 grados.' })
  userNotes?: string | null;

  @ApiPropertyOptional({
    example: { weightKg: 24.0, reps: 7, date: '2026-09-20', estimated1RM: 29.6 },
  })
  personalRecord?: {
    weightKg: number;
    reps: number;
    date: string;
    estimated1RM: number;
  } | null;

  static fromEntity(
    exercise: any,
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
      minReps: exercise.minReps ?? 8,
      maxReps: exercise.maxReps ?? 12,
      defaultSets: exercise.defaultSets ?? 3,
      suggestedSets: exercise.defaultSets ?? 3,
      suggestedMinReps: exercise.minReps ?? 8,
      suggestedMaxReps: exercise.maxReps ?? 12,
      suggestedWeightKg: 0,
      suggestedWeightLabel: '0 kg',
      restSeconds: exercise.restSeconds ?? 90,
      instructions: exercise.instructions ?? [],
      videoUrl: exercise.videoUrl ?? null,
      imageUrl: exercise.imageUrl ?? null,
      userNotes: null,
      personalRecord: null,
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
      minReps: resolved.minReps,
      maxReps: resolved.maxReps,
      defaultSets: resolved.defaultSets,
      suggestedSets: resolved.suggestedSets,
      suggestedMinReps: resolved.suggestedMinReps,
      suggestedMaxReps: resolved.suggestedMaxReps,
      suggestedWeightKg: resolved.suggestedWeightKg,
      suggestedWeightLabel: resolved.suggestedWeightLabel,
      restSeconds: resolved.restSeconds,
      instructions: resolved.instructions,
      videoUrl: resolved.videoUrl ?? null,
      imageUrl: resolved.imageUrl ?? null,
      userNotes: resolved.userNotes ?? null,
      personalRecord: resolved.personalRecord ?? null,
    };
  }
}
