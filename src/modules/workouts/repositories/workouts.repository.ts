import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Exercise, Workout } from '@prisma/client';
import { CreateWorkoutDto } from '../dto/create-workout.dto';
import { UpdateWorkoutDto } from '../dto/update-workout.dto';

@Injectable()
export class WorkoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Workout | null> {
    return this.prisma.workout.findUnique({
      where: { id },
    });
  }

  async findByIdWithExercises(
    id: string,
  ): Promise<(Workout & { exercises: Exercise[] }) | null> {
    return this.prisma.workout.findUnique({
      where: { id },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findByProgramId(programId: string): Promise<Workout[]> {
    return this.prisma.workout.findMany({
      where: { programId },
      orderBy: { title: 'asc' },
    });
  }

  async create(data: CreateWorkoutDto): Promise<Workout> {
    return this.prisma.workout.create({
      data,
    });
  }

  async update(id: string, data: UpdateWorkoutDto): Promise<Workout> {
    return this.prisma.workout.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Workout> {
    return this.prisma.workout.delete({
      where: { id },
    });
  }
}
