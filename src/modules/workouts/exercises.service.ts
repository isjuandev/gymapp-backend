import { Injectable, NotFoundException } from '@nestjs/common';
import { ExercisesRepository } from './repositories/exercises.repository';
import { WorkoutsRepository } from './repositories/workouts.repository';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExerciseResponseDto } from './dto/exercise-response.dto';

@Injectable()
export class ExercisesService {
  constructor(
    private readonly exercisesRepository: ExercisesRepository,
    private readonly workoutsRepository: WorkoutsRepository,
  ) {}

  async addExercise(
    workoutId: string,
    dto: CreateExerciseDto,
  ): Promise<ExerciseResponseDto> {
    const workout = await this.workoutsRepository.findById(workoutId);
    if (!workout) {
      throw new NotFoundException(`Workout with ID '${workoutId}' not found`);
    }

    const exercise = await this.exercisesRepository.create(workoutId, dto);
    return ExerciseResponseDto.fromEntity(exercise);
  }

  async updateExercise(
    id: string,
    dto: UpdateExerciseDto,
  ): Promise<ExerciseResponseDto> {
    const existing = await this.exercisesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Exercise with ID '${id}' not found`);
    }

    const updated = await this.exercisesRepository.update(id, dto);
    return ExerciseResponseDto.fromEntity(updated);
  }

  async deleteExercise(id: string): Promise<{ message: string }> {
    const existing = await this.exercisesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Exercise with ID '${id}' not found`);
    }

    await this.exercisesRepository.delete(id);
    return { message: `Exercise with ID '${id}' deleted successfully` };
  }
}
