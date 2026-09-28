import { Injectable, NotFoundException } from '@nestjs/common';
import { ProgramsRepository } from './repositories/programs.repository';
import { ProgramFilterDto } from './dto/program-filter.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramResponseDto } from './dto/program-response.dto';
import { ProgramDetailResponseDto } from './dto/program-detail-response.dto';
import { PlanService } from '../plan/plan.service';
import { WeeklyPlanResponseDto } from '../plan/dto/weekly-plan-response.dto';

@Injectable()
export class ProgramsService {
  constructor(
    private readonly programsRepository: ProgramsRepository,
    private readonly planService: PlanService,
  ) {}

  async getAllPrograms(
    filter?: ProgramFilterDto,
  ): Promise<ProgramResponseDto[]> {
    const programs = await this.programsRepository.findAll({
      category: filter?.category,
    });
    return programs.map((p) => ProgramResponseDto.fromEntity(p));
  }

  async getProgramById(id: string): Promise<ProgramDetailResponseDto> {
    const program = await this.programsRepository.findByIdWithWorkouts(id);
    if (!program) {
      throw new NotFoundException(`Program with ID '${id}' not found`);
    }
    return ProgramDetailResponseDto.fromEntityWithWorkouts(program);
  }

  async enrollInProgram(
    userId: string,
    programId: string,
  ): Promise<WeeklyPlanResponseDto> {
    const program = await this.programsRepository.findById(programId);
    if (!program) {
      throw new NotFoundException(`Program with ID '${programId}' not found`);
    }

    // Single-writer preset assignment (canonical plan + schedule + goals).
    const { weeklyPlan } = await this.planService.assignPlan(userId, programId);
    return weeklyPlan;
  }

  async createProgram(dto: CreateProgramDto): Promise<ProgramResponseDto> {
    const program = await this.programsRepository.create(dto);
    return ProgramResponseDto.fromEntity(program);
  }

  async updateProgram(
    id: string,
    dto: UpdateProgramDto,
  ): Promise<ProgramResponseDto> {
    const existing = await this.programsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Program with ID '${id}' not found`);
    }

    const updated = await this.programsRepository.update(id, dto);
    return ProgramResponseDto.fromEntity(updated);
  }

  async deleteProgram(id: string): Promise<{ message: string }> {
    const existing = await this.programsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Program with ID '${id}' not found`);
    }

    await this.programsRepository.delete(id);
    return { message: `Program with ID '${id}' deleted successfully` };
  }
}
