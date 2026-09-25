import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { WorkoutsRepository } from './repositories/workouts.repository';
import { ProgramsRepository } from '../programs/repositories/programs.repository';
import { RecommendationService } from '../recommendation/recommendation.service';
import { Exercise, Workout, MuscleGroup } from '@prisma/client';

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let workoutsRepo: jest.Mocked<WorkoutsRepository>;
  let programsRepo: jest.Mocked<ProgramsRepository>;
  let recommendationService: jest.Mocked<RecommendationService>;

  const mockWorkout: Workout = {
    id: '22222222-2222-2222-2222-222222222221',
    programId: '11111111-1111-1111-1111-111111111111',
    title: 'Pecho Power',
    durationMinutes: 45,
    difficulty: 'Intermedio',
    kcalEstimate: 400,
    imageAssetName: 'workout_chest',
    rounds: 4,
  };

  const mockExercise: Exercise = {
    id: '33333333-3333-3333-3333-333333333331',
    workoutId: mockWorkout.id,
    name: 'Press de Banca Plano con Barra',
    order: 1,
    kind: { type: 'reps', count: 10 },
    imageAssetName: 'ex_bench',
    primaryMuscleGroup: MuscleGroup.CHEST,
    requiredEquipmentId: 'eq-barbell',
    substitutionGroupId: 'sub_chest_press',
  };

  beforeEach(async () => {
    const mockWorkoutsRepo = {
      findById: jest.fn(),
      findByIdWithExercises: jest.fn(),
      findByProgramId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockProgramsRepo = {
      findById: jest.fn(),
    };

    const mockRecommendationService = {
      generateWeeklyPlan: jest.fn(),
      resolveExerciseForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        { provide: WorkoutsRepository, useValue: mockWorkoutsRepo },
        { provide: ProgramsRepository, useValue: mockProgramsRepo },
        { provide: RecommendationService, useValue: mockRecommendationService },
      ],
    }).compile();

    service = module.get<WorkoutsService>(WorkoutsService);
    workoutsRepo = module.get(WorkoutsRepository);
    programsRepo = module.get(ProgramsRepository);
    recommendationService = module.get(RecommendationService);
  });

  describe('getWorkoutById', () => {
    it('should return workout detail with ordered exercises when no userId is passed', async () => {
      workoutsRepo.findByIdWithExercises.mockResolvedValue({
        ...mockWorkout,
        exercises: [mockExercise],
      });

      const result = await service.getWorkoutById(mockWorkout.id);

      expect(result.id).toBe(mockWorkout.id);
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].id).toBe(mockExercise.id);
    });

    it('should dynamically adapt exercises to user equipment preferences when userId is provided', async () => {
      workoutsRepo.findByIdWithExercises.mockResolvedValue({
        ...mockWorkout,
        exercises: [mockExercise],
      });

      const substitutedExercise = {
        id: 'substitute-id-999',
        name: 'Press con Mancuernas',
        order: mockExercise.order,
        kind: mockExercise.kind,
        imageAssetName: 'ex_dumbbell_bench',
        primaryMuscleGroup: MuscleGroup.CHEST,
        requiredEquipmentId: 'eq-dumbbells',
        substitutionGroupId: 'sub_chest_press',
        wasSubstituted: true,
        originalExerciseId: mockExercise.id,
        noEquipmentAvailable: false,
      };

      recommendationService.resolveExerciseForUser.mockResolvedValue(
        substitutedExercise,
      );

      const result = await service.getWorkoutById(
        mockWorkout.id,
        'user-uuid-1111',
      );

      expect(recommendationService.resolveExerciseForUser).toHaveBeenCalledWith(
        mockExercise.id,
        'user-uuid-1111',
      );
      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].id).toBe('substitute-id-999');
      expect(result.exercises[0].wasSubstituted).toBe(true);
      expect(result.exercises[0].originalExerciseId).toBe(mockExercise.id);
    });

    it('should throw NotFoundException when workout does not exist', async () => {
      workoutsRepo.findByIdWithExercises.mockResolvedValue(null);

      await expect(service.getWorkoutById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createWorkout', () => {
    it('should create workout when programId exists', async () => {
      programsRepo.findById.mockResolvedValue({
        id: mockWorkout.programId,
      } as any);
      workoutsRepo.create.mockResolvedValue(mockWorkout);

      const result = await service.createWorkout({
        programId: mockWorkout.programId,
        title: mockWorkout.title,
        durationMinutes: mockWorkout.durationMinutes,
        difficulty: mockWorkout.difficulty,
        kcalEstimate: mockWorkout.kcalEstimate,
        imageAssetName: mockWorkout.imageAssetName,
        rounds: mockWorkout.rounds,
      });

      expect(result.id).toBe(mockWorkout.id);
    });

    it('should throw BadRequestException when programId does not exist', async () => {
      programsRepo.findById.mockResolvedValue(null);

      await expect(
        service.createWorkout({
          programId: 'non-existent-program',
          title: mockWorkout.title,
          durationMinutes: 40,
          difficulty: 'Facil',
          kcalEstimate: 300,
          imageAssetName: 'img',
          rounds: 3,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateWorkout', () => {
    it('should update workout when it exists', async () => {
      workoutsRepo.findById.mockResolvedValue(mockWorkout);
      workoutsRepo.update.mockResolvedValue({
        ...mockWorkout,
        title: 'Updated Workout',
      });

      const result = await service.updateWorkout(mockWorkout.id, {
        title: 'Updated Workout',
      });

      expect(result.title).toBe('Updated Workout');
    });

    it('should throw NotFoundException when updating non-existent workout', async () => {
      workoutsRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateWorkout('non-existent', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteWorkout', () => {
    it('should delete workout when it exists', async () => {
      workoutsRepo.findById.mockResolvedValue(mockWorkout);
      workoutsRepo.delete.mockResolvedValue(mockWorkout);

      const result = await service.deleteWorkout(mockWorkout.id);

      expect(result).toEqual({
        message: `Workout with ID '${mockWorkout.id}' deleted successfully`,
      });
    });

    it('should throw NotFoundException when deleting non-existent workout', async () => {
      workoutsRepo.findById.mockResolvedValue(null);

      await expect(service.deleteWorkout('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
