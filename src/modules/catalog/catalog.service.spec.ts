import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AscendApiService } from '../ascend-api/ascend-api.service';
import { EquipmentCategory, MuscleGroup, WeightType } from '@prisma/client';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: any;
  let ascendApiService: any;

  const mockEquipment = {
    id: 'eq-111',
    name: 'Barra Olímpica',
    category: EquipmentCategory.FREE_WEIGHTS,
    weightType: WeightType.BARBELL,
    incrementKg: 2.5,
    minWeightKg: 20,
    maxWeightKg: 200,
  };

  const mockCatalogItem = {
    id: 'cat-111',
    externalId: 'asc-111',
    name: 'Barbell Bench Press',
    nameEs: 'Press de Banca con Barra',
    videoUrl: 'https://cdn.exercisedb.dev/videos/bench.mp4',
    imageUrl: 'https://cdn.exercisedb.dev/images/bench.webp',
    instructions: ['Lie on bench', 'Lower bar to chest', 'Push up'],
    exerciseTips: ['Keep elbows tucked', 'Drive with feet'],
    primaryMuscleGroup: MuscleGroup.CHEST,
    targetMuscles: ['pectoralis major'],
    secondaryMuscles: ['triceps', 'anterior deltoid'],
    equipmentCategory: EquipmentCategory.FREE_WEIGHTS,
    equipmentName: 'BARBELL',
    suggestedMinReps: 8,
    suggestedMaxReps: 12,
    defaultRestSeconds: 90,
    equipmentId: 'eq-111',
    equipment: mockEquipment,
  };

  beforeEach(async () => {
    prisma = {
      exerciseCatalog: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      equipment: {
        findFirst: jest.fn(),
      },
    };

    ascendApiService = {
      getExercises: jest.fn(),
      getExerciseById: jest.fn(),
      searchExercises: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AscendApiService, useValue: ascendApiService },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  describe('listExercises', () => {
    it('should return catalog exercises list with pagination', async () => {
      prisma.exerciseCatalog.findMany.mockResolvedValue([mockCatalogItem]);
      prisma.exerciseCatalog.count.mockResolvedValue(1);

      const result = await service.listExercises({
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Barbell Bench Press');
      expect(result.items[0].equipment?.name).toBe('Barra Olímpica');
    });

    it('should fallback to AscendAPI search when no local results are found', async () => {
      prisma.exerciseCatalog.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockCatalogItem]);
      prisma.exerciseCatalog.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      ascendApiService.searchExercises.mockResolvedValue([
        {
          exerciseId: 'asc-111',
          name: 'Barbell Bench Press',
          equipments: ['barbell'],
          bodyParts: ['chest'],
        },
      ]);
      prisma.equipment.findFirst.mockResolvedValue(mockEquipment);
      prisma.exerciseCatalog.upsert.mockResolvedValue(mockCatalogItem);

      const result = await service.listExercises({
        search: 'bench',
        limit: 20,
        offset: 0,
      });

      expect(ascendApiService.searchExercises).toHaveBeenCalledWith('bench', 10);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getExerciseById', () => {
    it('should return exercise when found by ID', async () => {
      prisma.exerciseCatalog.findFirst.mockResolvedValue(mockCatalogItem);

      const result = await service.getExerciseById(mockCatalogItem.id);

      expect(result.id).toBe(mockCatalogItem.id);
      expect(result.videoUrl).toBe(mockCatalogItem.videoUrl);
    });

    it('should throw NotFoundException when exercise is not found anywhere', async () => {
      prisma.exerciseCatalog.findFirst.mockResolvedValue(null);
      ascendApiService.getExerciseById.mockResolvedValue(null);

      await expect(service.getExerciseById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMuscleGroups', () => {
    it('should return list of muscle groups with Spanish labels', async () => {
      const groups = await service.getMuscleGroups();
      expect(groups.length).toBeGreaterThan(0);
      expect(groups).toContainEqual({ value: MuscleGroup.CHEST, label: 'Pecho' });
    });
  });

  describe('syncFromAscendApi', () => {
    it('should sync exercises from AscendAPI', async () => {
      ascendApiService.getExercises.mockResolvedValue({
        success: true,
        data: [
          {
            exerciseId: 'asc-111',
            name: 'Barbell Bench Press',
            bodyParts: ['chest'],
            equipments: ['barbell'],
          },
        ],
      });
      prisma.equipment.findFirst.mockResolvedValue(mockEquipment);
      prisma.exerciseCatalog.upsert.mockResolvedValue(mockCatalogItem);

      const result = await service.syncFromAscendApi(10);

      expect(result.syncedCount).toBe(1);
      expect(result.totalFetched).toBe(1);
      expect(prisma.exerciseCatalog.upsert).toHaveBeenCalled();
    });
  });
});
