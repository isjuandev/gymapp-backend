import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentRepository } from './repositories/equipment.repository';
import { EquipmentCategory } from '@prisma/client';

describe('EquipmentService', () => {
  let service: EquipmentService;
  let repository: jest.Mocked<EquipmentRepository>;

  const userId = 'user-uuid-1111';
  const equipmentId = '88888888-8888-4888-8888-888888888881';

  const mockEquipment = {
    id: equipmentId,
    name: 'Barra Olímpica y Banco Plano',
    category: EquipmentCategory.FREE_WEIGHTS,
    imageAssetName: 'eq_barbell_bench',
    isAvailableAtGym: true,
  };

  beforeEach(async () => {
    const mockRepo = {
      findAvailable: jest.fn(),
      findById: jest.fn(),
      updateAvailability: jest.fn(),
      getUserEquipmentPreferences: jest.fn(),
      replaceUserEquipmentPreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        { provide: EquipmentRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<EquipmentService>(EquipmentService);
    repository = module.get(EquipmentRepository);
  });

  describe('getAvailableEquipment', () => {
    it('should return available equipment', async () => {
      repository.findAvailable.mockResolvedValue([mockEquipment]);

      const result = await service.getAvailableEquipment(
        EquipmentCategory.FREE_WEIGHTS,
      );

      expect(repository.findAvailable).toHaveBeenCalledWith(
        EquipmentCategory.FREE_WEIGHTS,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(equipmentId);
      expect(result[0].isAvailableAtGym).toBe(true);
    });
  });

  describe('updateAvailability', () => {
    it('should update availability and return equipment', async () => {
      repository.updateAvailability.mockResolvedValue({
        ...mockEquipment,
        isAvailableAtGym: false,
      });

      const result = await service.updateAvailability(equipmentId, false);

      expect(repository.updateAvailability).toHaveBeenCalledWith(
        equipmentId,
        false,
      );
      expect(result.isAvailableAtGym).toBe(false);
    });

    it('should throw NotFoundException when equipment does not exist', async () => {
      repository.updateAvailability.mockResolvedValue(null);

      await expect(
        service.updateAvailability('unknown-id', false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserEquipmentPreferences', () => {
    it('should return equipmentIds array', async () => {
      repository.getUserEquipmentPreferences.mockResolvedValue([equipmentId]);

      const result = await service.getUserEquipmentPreferences(userId);

      expect(repository.getUserEquipmentPreferences).toHaveBeenCalledWith(
        userId,
      );
      expect(result.equipmentIds).toEqual([equipmentId]);
    });
  });

  describe('replaceUserEquipmentPreferences', () => {
    it('should replace and return updated equipmentIds array', async () => {
      repository.replaceUserEquipmentPreferences.mockResolvedValue([
        equipmentId,
      ]);

      const result = await service.replaceUserEquipmentPreferences(userId, [
        equipmentId,
      ]);

      expect(repository.replaceUserEquipmentPreferences).toHaveBeenCalledWith(
        userId,
        [equipmentId],
      );
      expect(result.equipmentIds).toEqual([equipmentId]);
    });
  });
});
