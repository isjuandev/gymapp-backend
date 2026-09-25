import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Equipment, EquipmentCategory } from '@prisma/client';

@Injectable()
export class EquipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailable(category?: EquipmentCategory): Promise<Equipment[]> {
    return this.prisma.equipment.findMany({
      where: {
        isAvailableAtGym: true,
        ...(category ? { category } : {}),
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string): Promise<Equipment | null> {
    return this.prisma.equipment.findUnique({
      where: { id },
    });
  }

  async updateAvailability(
    id: string,
    isAvailable?: boolean,
  ): Promise<Equipment | null> {
    const existing = await this.prisma.equipment.findUnique({
      where: { id },
    });

    if (!existing) {
      return null;
    }

    const nextAvailability =
      isAvailable !== undefined ? isAvailable : !existing.isAvailableAtGym;

    return this.prisma.equipment.update({
      where: { id },
      data: {
        isAvailableAtGym: nextAvailability,
      },
    });
  }

  async getUserEquipmentPreferences(userId: string): Promise<string[]> {
    const preferences = await this.prisma.userEquipmentPreference.findMany({
      where: {
        userId,
        isSelected: true,
      },
      select: {
        equipmentId: true,
      },
    });

    return preferences.map((p) => p.equipmentId);
  }

  async replaceUserEquipmentPreferences(
    userId: string,
    equipmentIds: string[],
  ): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete previous preferences for this user
      await tx.userEquipmentPreference.deleteMany({
        where: { userId },
      });

      // 2. Create new preferences if any are provided
      if (equipmentIds.length > 0) {
        // Remove potential duplicates in input
        const uniqueIds = Array.from(new Set(equipmentIds));
        await tx.userEquipmentPreference.createMany({
          data: uniqueIds.map((equipmentId) => ({
            userId,
            equipmentId,
            isSelected: true,
          })),
        });
      }

      return equipmentIds;
    });
  }
}
