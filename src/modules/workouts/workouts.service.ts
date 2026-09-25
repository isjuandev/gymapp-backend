import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WorkoutsRepository } from './repositories/workouts.repository';
import { ProgramsRepository } from '../programs/repositories/programs.repository';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutResponseDto } from './dto/workout-response.dto';
import { WorkoutDetailResponseDto } from './dto/workout-detail-response.dto';
import { ExerciseResponseDto } from './dto/exercise-response.dto';
import { RecommendationService } from '../recommendation/recommendation.service';

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly workoutsRepository: WorkoutsRepository,
    private readonly programsRepository: ProgramsRepository,
    private readonly recommendationService: RecommendationService,
  ) {}

  async getWorkoutById(
    id: string,
    userId?: string,
  ): Promise<WorkoutDetailResponseDto> {
    const workout = await this.workoutsRepository.findByIdWithExercises(id);
    if (!workout) {
      throw new NotFoundException(`Workout with ID '${id}' not found`);
    }

    if (!userId) {
      return WorkoutDetailResponseDto.fromEntityWithExercises(workout);
    }

    const resolvedExercises = await Promise.all(
      workout.exercises.map(async (ex) => {
        const resolved =
          await this.recommendationService.resolveExerciseForUser(
            ex.id,
            userId,
          );
        return ExerciseResponseDto.fromResolved(resolved, workout.id);
      }),
    );

    const base = WorkoutResponseDto.fromEntity(workout);
    return {
      ...base,
      exercises: resolvedExercises,
    };
  }

  async createWorkout(dto: CreateWorkoutDto): Promise<WorkoutResponseDto> {
    const program = await this.programsRepository.findById(dto.programId);
    if (!program) {
      throw new BadRequestException(
        `Referenced program with ID '${dto.programId}' does not exist`,
      );
    }

    const workout = await this.workoutsRepository.create(dto);
    return WorkoutResponseDto.fromEntity(workout);
  }

  async updateWorkout(
    id: string,
    dto: UpdateWorkoutDto,
  ): Promise<WorkoutResponseDto> {
    const existing = await this.workoutsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Workout with ID '${id}' not found`);
    }

    if (dto.programId) {
      const program = await this.programsRepository.findById(dto.programId);
      if (!program) {
        throw new BadRequestException(
          `Referenced program with ID '${dto.programId}' does not exist`,
        );
      }
    }

    const updated = await this.workoutsRepository.update(id, dto);
    return WorkoutResponseDto.fromEntity(updated);
  }

  async deleteWorkout(id: string): Promise<{ message: string }> {
    const existing = await this.workoutsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Workout with ID '${id}' not found`);
    }

    await this.workoutsRepository.delete(id);
    return { message: `Workout with ID '${id}' deleted successfully` };
  }
}
