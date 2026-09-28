import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { ProgramsRepository } from './repositories/programs.repository';
import { AuthModule } from '../auth/auth.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [AuthModule, PlanModule],
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramsRepository],
  exports: [ProgramsService, ProgramsRepository],
})
export class ProgramsModule {}
