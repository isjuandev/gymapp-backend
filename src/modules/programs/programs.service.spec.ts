import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { ProgramsRepository } from './repositories/programs.repository';
import {
  Program,
  ProgramCategory,
  ProgramLevel,
  ProgramLocation,
  Workout,
} from '@prisma/client';

describe('ProgramsService', () => {
  let service: ProgramsService;
  let repository: jest.Mocked<ProgramsRepository>;

  const mockProgram: Program = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Hipertrofia Total',
    category: ProgramCategory.MUSCLE_GAIN,
    durationWeeks: 8,
    level: ProgramLevel.INTERMEDIATE,
    location: ProgramLocation.GYM,
    tagline: 'Gana masa muscular',
    imageAssetName: 'program_hypertrophy',
  };

  const mockWorkout: Workout = {
    id: '22222222-2222-2222-2222-222222222221',
    programId: mockProgram.id,
    title: 'Pecho Power',
    durationMinutes: 45,
    difficulty: 'Intermedio',
    kcalEstimate: 400,
    imageAssetName: 'workout_chest',
    rounds: 4,
  };

  beforeEach(async () => {
    const mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithWorkouts: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramsService,
        { provide: ProgramsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ProgramsService>(ProgramsService);
    repository = module.get(ProgramsRepository);
  });

  describe('getAllPrograms', () => {
    it('should return list of program DTOs', async () => {
      repository.findAll.mockResolvedValue([mockProgram]);

      const result = await service.getAllPrograms({
        category: ProgramCategory.MUSCLE_GAIN,
      });

      expect(repository.findAll).toHaveBeenCalledWith({
        category: ProgramCategory.MUSCLE_GAIN,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProgram.id);
      expect(result[0].title).toBe(mockProgram.title);
    });
  });

  describe('getProgramById', () => {
    it('should return program with workouts', async () => {
      repository.findByIdWithWorkouts.mockResolvedValue({
        ...mockProgram,
        workouts: [mockWorkout],
      });

      const result = await service.getProgramById(mockProgram.id);

      expect(result.id).toBe(mockProgram.id);
      expect(result.workouts).toHaveLength(1);
      expect(result.workouts[0].id).toBe(mockWorkout.id);
    });

    it('should throw NotFoundException when program not found', async () => {
      repository.findByIdWithWorkouts.mockResolvedValue(null);

      await expect(service.getProgramById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createProgram', () => {
    it('should create program and return DTO', async () => {
      repository.create.mockResolvedValue(mockProgram);

      const result = await service.createProgram({
        title: mockProgram.title,
        category: mockProgram.category,
        durationWeeks: mockProgram.durationWeeks,
        level: mockProgram.level,
        location: mockProgram.location,
        tagline: mockProgram.tagline,
        imageAssetName: mockProgram.imageAssetName,
      });

      expect(result.id).toBe(mockProgram.id);
    });
  });

  describe('updateProgram', () => {
    it('should update program when exists', async () => {
      repository.findById.mockResolvedValue(mockProgram);
      repository.update.mockResolvedValue({
        ...mockProgram,
        title: 'Updated Title',
      });

      const result = await service.updateProgram(mockProgram.id, {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException when updating non-existent program', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateProgram('non-existent', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProgram', () => {
    it('should delete program when exists', async () => {
      repository.findById.mockResolvedValue(mockProgram);
      repository.delete.mockResolvedValue(mockProgram);

      const result = await service.deleteProgram(mockProgram.id);

      expect(result).toEqual({
        message: `Program with ID '${mockProgram.id}' deleted successfully`,
      });
    });

    it('should throw NotFoundException when deleting non-existent program', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.deleteProgram('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
