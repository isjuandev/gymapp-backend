import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Exercise, Prisma } from '@prisma/client';
import { CreateExerciseDto } from '../dto/create-exercise.dto';
import { UpdateExerciseDto } from '../dto/update-exercise.dto';

@Injectable()
export class ExercisesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Exercise | null> {
    return this.prisma.exercise.findUnique({
      where: { id },
    });
  }

  async findByWorkoutId(workoutId: string): Promise<Exercise[]> {
    return this.prisma.exercise.findMany({
      where: { workoutId },
      orderBy: { order: 'asc' },
    });
  }

  async create(workoutId: string, data: CreateExerciseDto): Promise<Exercise> {
    return this.prisma.exercise.create({
      data: {
        workoutId,
        name: data.name,
        order: data.order,
        kind: data.kind as unknown as Prisma.InputJsonValue,
        imageAssetName: data.imageAssetName,
      },
    });
  }

  async update(id: string, data: UpdateExerciseDto): Promise<Exercise> {
    return this.prisma.exercise.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.kind
          ? { kind: data.kind as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.imageAssetName ? { imageAssetName: data.imageAssetName } : {}),
      },
    });
  }

  async delete(id: string): Promise<Exercise> {
    return this.prisma.exercise.delete({
      where: { id },
    });
  }
}
