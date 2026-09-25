import { Injectable, NotFoundException } from '@nestjs/common';
import { Equipment, EquipmentCategory } from '@prisma/client';
import {
  EquipmentResponseDto,
  UserEquipmentPreferencesResponseDto,
} from './dto';
import { EquipmentRepository } from './repositories/equipment.repository';

@Injectable()
export class EquipmentService {
  constructor(private readonly equipmentRepository: EquipmentRepository) {}

  async getAvailableEquipment(
    category?: EquipmentCategory,
  ): Promise<EquipmentResponseDto[]> {
    const list = await this.equipmentRepository.findAvailable(category);
    return list.map((item) => this.toResponseDto(item));
  }

  async updateAvailability(
    id: string,
    isAvailableAtGym?: boolean,
  ): Promise<EquipmentResponseDto> {
    const updated = await this.equipmentRepository.updateAvailability(
      id,
      isAvailableAtGym,
    );

    if (!updated) {
      throw new NotFoundException(`Equipment with ID '${id}' not found`);
    }

    return this.toResponseDto(updated);
  }

  async getUserEquipmentPreferences(
    userId: string,
  ): Promise<UserEquipmentPreferencesResponseDto> {
    const equipmentIds =
      await this.equipmentRepository.getUserEquipmentPreferences(userId);
    return { equipmentIds };
  }

  async replaceUserEquipmentPreferences(
    userId: string,
    equipmentIds: string[],
  ): Promise<UserEquipmentPreferencesResponseDto> {
    const updatedIds =
      await this.equipmentRepository.replaceUserEquipmentPreferences(
        userId,
        equipmentIds,
      );
    return { equipmentIds: updatedIds };
  }

  private toResponseDto(equipment: Equipment): EquipmentResponseDto {
    return {
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      imageAssetName: equipment.imageAssetName,
      isAvailableAtGym: equipment.isAvailableAtGym,
    };
  }
}
