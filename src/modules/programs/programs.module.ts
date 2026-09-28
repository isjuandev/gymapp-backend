import { Module, forwardRef } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { ProgramsRepository } from './repositories/programs.repository';
import { AuthModule } from '../auth/auth.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  // forwardRef: PlanModule -> WorkoutsModule -> ProgramsModule already exists;
  // this edge (enroll = plan assignment) closes the loop, so it resolves lazily.
  imports: [AuthModule, forwardRef(() => PlanModule)],
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramsRepository],
  exports: [ProgramsService, ProgramsRepository],
})
export class ProgramsModule {}
