import { ApiProperty } from '@nestjs/swagger';
import { Exercise, Workout } from '@prisma/client';
import { WorkoutResponseDto } from './workout-response.dto';
import { ExerciseResponseDto } from './exercise-response.dto';

export class WorkoutDetailResponseDto extends WorkoutResponseDto {
  @ApiProperty({
    type: () => [ExerciseResponseDto],
    description: 'Exercises included in this workout, ordered by sequence',
  })
  exercises: ExerciseResponseDto[];

  static fromEntityWithExercises(
    workout: Workout & { exercises: Exercise[] },
  ): WorkoutDetailResponseDto {
    const base = WorkoutResponseDto.fromEntity(workout);
    return {
      ...base,
      exercises: (workout.exercises || []).map((e) =>
        ExerciseResponseDto.fromEntity(e),
      ),
    };
  }
}
