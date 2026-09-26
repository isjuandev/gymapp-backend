import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { MuscleGroup } from '@prisma/client';

export class CustomWorkoutExerciseInputDto {
  @ApiProperty({
    example: '33333333-3333-4333-8333-333333333331',
    description: 'UUID of the catalog exercise from ExerciseCatalog',
  })
  @IsUUID('all', { message: 'exerciseId must be a valid UUID' })
  @IsNotEmpty({ message: 'exerciseId is required' })
  exerciseId: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Sequence order of the exercise',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  order?: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Target sets for the exercise',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  targetSets?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Target reps per set',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  targetReps?: number;
}

export class CreateCustomWorkoutDto {
  @ApiProperty({
    example: 'Mi Rutina de Pecho y Tríceps',
    description: 'Custom workout title',
  })
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title: string;

  @ApiPropertyOptional({
    enum: MuscleGroup,
    example: MuscleGroup.CHEST,
    description: 'Primary muscle group focus',
  })
  @IsOptional()
  @IsEnum(MuscleGroup, {
    message:
      'primaryMuscleGroup must be one of CHEST, BACK, LEGS, SHOULDERS, ARMS, CORE, CARDIO, FULL_BODY',
  })
  primaryMuscleGroup?: MuscleGroup;

  @ApiProperty({
    type: [CustomWorkoutExerciseInputDto],
    description: 'Catalog exercises configured for this custom workout',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomWorkoutExerciseInputDto)
  exercises: CustomWorkoutExerciseInputDto[];
}
