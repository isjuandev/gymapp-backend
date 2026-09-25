import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Program, ProgramCategory, Workout } from '@prisma/client';
import { CreateProgramDto } from '../dto/create-program.dto';
import { UpdateProgramDto } from '../dto/update-program.dto';

@Injectable()
export class ProgramsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter?: { category?: ProgramCategory }): Promise<Program[]> {
    return this.prisma.program.findMany({
      where: filter?.category ? { category: filter.category } : undefined,
      orderBy: { title: 'asc' },
    });
  }

  async findById(id: string): Promise<Program | null> {
    return this.prisma.program.findUnique({
      where: { id },
    });
  }

  async findByIdWithWorkouts(
    id: string,
  ): Promise<(Program & { workouts: Workout[] }) | null> {
    return this.prisma.program.findUnique({
      where: { id },
      include: {
        workouts: {
          orderBy: { title: 'asc' },
        },
      },
    });
  }

  async create(data: CreateProgramDto): Promise<Program> {
    return this.prisma.program.create({
      data,
    });
  }

  async update(id: string, data: UpdateProgramDto): Promise<Program> {
    return this.prisma.program.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Program> {
    return this.prisma.program.delete({
      where: { id },
    });
  }
}
