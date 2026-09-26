import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MuscleGroup } from '@prisma/client';
import { CustomWorkoutExerciseInputDto } from './create-custom-workout.dto';

export class UpdateCustomWorkoutDto {
  @ApiPropertyOptional({
    example: 'Mi Rutina Modificada',
    description: 'Updated title of the custom workout',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    enum: MuscleGroup,
    example: MuscleGroup.CHEST,
    description: 'Updated primary muscle group',
  })
  @IsOptional()
  @IsEnum(MuscleGroup, {
    message:
      'primaryMuscleGroup must be one of CHEST, BACK, LEGS, SHOULDERS, ARMS, CORE, CARDIO, FULL_BODY',
  })
  primaryMuscleGroup?: MuscleGroup;

  @ApiPropertyOptional({
    type: [CustomWorkoutExerciseInputDto],
    description: 'Updated list of catalog exercises',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomWorkoutExerciseInputDto)
  exercises?: CustomWorkoutExerciseInputDto[];
}
