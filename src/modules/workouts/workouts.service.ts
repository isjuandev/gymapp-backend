import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkoutsRepository } from './repositories/workouts.repository';
import { ProgramsRepository } from '../programs/repositories/programs.repository';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { CreateCustomWorkoutDto } from './dto/create-custom-workout.dto';
import { UpdateCustomWorkoutDto } from './dto/update-custom-workout.dto';
import { WorkoutResponseDto } from './dto/workout-response.dto';
import { WorkoutDetailResponseDto } from './dto/workout-detail-response.dto';
import { ExerciseResponseDto } from './dto/exercise-response.dto';
import { RecommendationService } from '../recommendation/recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly workoutsRepository: WorkoutsRepository,
    private readonly programsRepository: ProgramsRepository,
    private readonly recommendationService: RecommendationService,
    private readonly prisma: PrismaService,
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

    const existingExerciseIdsInWorkout = new Set(workout.exercises.map((e) => e.id));
    const resolvedExercises: ExerciseResponseDto[] = [];
    for (const ex of workout.exercises) {
      const excludedIds = Array.from(existingExerciseIdsInWorkout).filter(
        (id) => id !== ex.id,
      );
      for (const r of resolvedExercises) {
        if (!excludedIds.includes(r.id)) {
          excludedIds.push(r.id);
        }
      }
      const resolved =
        await this.recommendationService.resolveExerciseForUser(
          ex.id,
          userId,
          excludedIds,
        );
      resolvedExercises.push(
        ExerciseResponseDto.fromResolved(resolved, workout.id),
      );
    }

    const base = WorkoutResponseDto.fromEntity(workout);
    return {
      ...base,
      exercises: resolvedExercises,
    };
  }

  async getWorkouts(programId?: string): Promise<WorkoutResponseDto[]> {
    const workouts = programId
      ? await this.workoutsRepository.findByProgramId(programId)
      : await this.workoutsRepository.findAll();
    return workouts.map((w) => WorkoutResponseDto.fromEntity(w));
  }

  async createWorkout(dto: CreateWorkoutDto): Promise<WorkoutResponseDto> {
    const program = await this.programsRepository.findById(dto.programId);
    if (!program) {
      throw new BadRequestException(
        `Referenced program with ID '${dto.programId}' does not exist`,
      );
    }

    // App-level check: exactly one of ownerUserId or programId must be set
    const ownerUserId = (dto as any).ownerUserId;
    if ((ownerUserId && dto.programId) || (!ownerUserId && !dto.programId)) {
      throw new BadRequestException(
        'A workout must have either an ownerUserId or a programId, but not both or neither.',
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
      if (existing.ownerUserId) {
        throw new BadRequestException(
          'A custom workout cannot be assigned to a program.',
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

  // ============================================================================
  // CUSTOM WORKOUTS
  // ============================================================================

  async createCustomWorkout(
    userId: string,
    dto: CreateCustomWorkoutDto,
  ): Promise<WorkoutDetailResponseDto> {
    // App-level check: ownerUserId is set, programId is null
    const ownerUserId = userId;
    const programId = null;
    if ((ownerUserId && programId) || (!ownerUserId && !programId)) {
      throw new BadRequestException(
        'A workout must have either an ownerUserId or a programId, but not both or neither.',
      );
    }

    if (!dto.exercises || dto.exercises.length === 0) {
      throw new BadRequestException(
        'A custom workout must include at least one exercise',
      );
    }

    // Validate that every exerciseId belongs to ExerciseCatalog
    const catalogExerciseIds = dto.exercises.map((e) => e.exerciseId);
    const catalogItems = await this.prisma.exerciseCatalog.findMany({
      where: { id: { in: catalogExerciseIds } },
    });

    const catalogMap = new Map(catalogItems.map((item) => [item.id, item]));
    for (const exInput of dto.exercises) {
      if (!catalogMap.has(exInput.exerciseId)) {
        throw new BadRequestException(
          `Catalog exercise with ID '${exInput.exerciseId}' not found in exercise catalog`,
        );
      }
    }

    // Build exercises data and calculate estimated duration / kcal
    let totalEstimatedSeconds = 0;
    const exercisesData = dto.exercises.map((exInput, index) => {
      const catalogItem = catalogMap.get(exInput.exerciseId)!;
      const targetSets = exInput.targetSets ?? 3;
      const targetReps = exInput.targetReps ?? catalogItem.suggestedMaxReps;
      const restSeconds = catalogItem.defaultRestSeconds ?? 90;
      totalEstimatedSeconds += targetSets * (45 + restSeconds);

      return {
        catalogId: catalogItem.id,
        name: catalogItem.nameEs || catalogItem.name,
        order: exInput.order ?? index + 1,
        kind: { type: 'reps', count: targetReps },
        imageAssetName: 'workout_card_default',
        videoUrl: catalogItem.videoUrl,
        imageUrl: catalogItem.imageUrl,
        instructions: catalogItem.instructions,
        primaryMuscleGroup:
          dto.primaryMuscleGroup ?? catalogItem.primaryMuscleGroup,
        requiredEquipmentId: catalogItem.equipmentId,
        substitutionGroupId: catalogItem.externalId || catalogItem.id,
        minReps: exInput.targetReps ?? catalogItem.suggestedMinReps,
        maxReps: exInput.targetReps ?? catalogItem.suggestedMaxReps,
        defaultSets: targetSets,
        restSeconds: restSeconds,
      };
    });

    const durationMinutes = Math.max(5, Math.round(totalEstimatedSeconds / 60));
    const kcalEstimate = Math.round(durationMinutes * 7.5);

    const workout = await this.prisma.workout.create({
      data: {
        title: dto.title,
        ownerUserId: userId,
        programId: null,
        durationMinutes,
        difficulty: 'Personalizada',
        kcalEstimate,
        imageAssetName: 'workout_card_default',
        rounds: 1,
        exercises: {
          create: exercisesData,
        },
      },
    });

    return this.getWorkoutById(workout.id, userId);
  }

  async getCustomWorkouts(userId: string): Promise<WorkoutDetailResponseDto[]> {
    const workouts = await this.workoutsRepository.findByOwnerUserIdWithExercises(
      userId,
    );

    const results: WorkoutDetailResponseDto[] = [];
    for (const workout of workouts) {
      const existingExerciseIdsInWorkout = new Set(
        workout.exercises.map((e) => e.id),
      );
      const resolvedExercises: ExerciseResponseDto[] = [];
      for (const ex of workout.exercises) {
        const excludedIds = Array.from(existingExerciseIdsInWorkout).filter(
          (id) => id !== ex.id,
        );
        for (const r of resolvedExercises) {
          if (!excludedIds.includes(r.id)) {
            excludedIds.push(r.id);
          }
        }
        const resolved =
          await this.recommendationService.resolveExerciseForUser(
            ex.id,
            userId,
            excludedIds,
          );
        resolvedExercises.push(
          ExerciseResponseDto.fromResolved(resolved, workout.id),
        );
      }

      const base = WorkoutResponseDto.fromEntity(workout);
      results.push({
        ...base,
        isCustom: true,
        exercises: resolvedExercises,
      });
    }

    return results;
  }

  async updateCustomWorkout(
    id: string,
    userId: string,
    dto: UpdateCustomWorkoutDto,
  ): Promise<WorkoutDetailResponseDto> {
    const workout = await this.workoutsRepository.findById(id);
    if (!workout) {
      throw new NotFoundException(`Workout with ID '${id}' not found`);
    }

    if (workout.ownerUserId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workout',
      );
    }

    if (
      (workout.ownerUserId && workout.programId) ||
      (!workout.ownerUserId && !workout.programId)
    ) {
      throw new BadRequestException(
        'A workout must have either an ownerUserId or a programId, but not both or neither.',
      );
    }

    if (dto.exercises && dto.exercises.length > 0) {
      const catalogExerciseIds = dto.exercises.map((e) => e.exerciseId);
      const catalogItems = await this.prisma.exerciseCatalog.findMany({
        where: { id: { in: catalogExerciseIds } },
      });
      const catalogMap = new Map(catalogItems.map((item) => [item.id, item]));

      for (const exInput of dto.exercises) {
        if (!catalogMap.has(exInput.exerciseId)) {
          throw new BadRequestException(
            `Catalog exercise with ID '${exInput.exerciseId}' not found in exercise catalog`,
          );
        }
      }

      let totalEstimatedSeconds = 0;
      const exercisesData = dto.exercises.map((exInput, index) => {
        const catalogItem = catalogMap.get(exInput.exerciseId)!;
        const targetSets = exInput.targetSets ?? 3;
        const targetReps = exInput.targetReps ?? catalogItem.suggestedMaxReps;
        const restSeconds = catalogItem.defaultRestSeconds ?? 90;
        totalEstimatedSeconds += targetSets * (45 + restSeconds);

        return {
          workoutId: id,
          catalogId: catalogItem.id,
          name: catalogItem.nameEs || catalogItem.name,
          order: exInput.order ?? index + 1,
          kind: { type: 'reps', count: targetReps },
          imageAssetName: 'workout_card_default',
          videoUrl: catalogItem.videoUrl,
          imageUrl: catalogItem.imageUrl,
          instructions: catalogItem.instructions,
          primaryMuscleGroup:
            dto.primaryMuscleGroup ?? catalogItem.primaryMuscleGroup,
          requiredEquipmentId: catalogItem.equipmentId,
          substitutionGroupId: catalogItem.externalId || catalogItem.id,
          minReps: exInput.targetReps ?? catalogItem.suggestedMinReps,
          maxReps: exInput.targetReps ?? catalogItem.suggestedMaxReps,
          defaultSets: targetSets,
          restSeconds: restSeconds,
        };
      });

      const durationMinutes = Math.max(5, Math.round(totalEstimatedSeconds / 60));
      const kcalEstimate = Math.round(durationMinutes * 7.5);

      await this.prisma.$transaction([
        this.prisma.exercise.deleteMany({ where: { workoutId: id } }),
        this.prisma.exercise.createMany({ data: exercisesData }),
        this.prisma.workout.update({
          where: { id },
          data: {
            title: dto.title ?? workout.title,
            durationMinutes,
            kcalEstimate,
          },
        }),
      ]);
    } else if (dto.title) {
      await this.prisma.workout.update({
        where: { id },
        data: { title: dto.title },
      });
    }

    return this.getWorkoutById(id, userId);
  }

  async deleteCustomWorkout(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const workout = await this.workoutsRepository.findById(id);
    if (!workout) {
      throw new NotFoundException(`Workout with ID '${id}' not found`);
    }

    if (workout.ownerUserId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this workout',
      );
    }

    await this.workoutsRepository.delete(id);
    return { message: `Custom workout with ID '${id}' deleted successfully` };
  }
}
