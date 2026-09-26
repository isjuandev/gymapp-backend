import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { ProgramsRepository } from './repositories/programs.repository';
import { AuthModule } from '../auth/auth.module';
import { RecommendationModule } from '../recommendation/recommendation.module';

@Module({
  imports: [AuthModule, RecommendationModule],
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramsRepository],
  exports: [ProgramsService, ProgramsRepository],
})
export class ProgramsModule {}
