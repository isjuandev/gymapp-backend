import { Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { PlanRepository } from './repositories/plan.repository';
import { AuthModule } from '../auth/auth.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { RecommendationModule } from '../recommendation/recommendation.module';

@Module({
  imports: [AuthModule, WorkoutsModule, RecommendationModule],
  controllers: [PlanController],
  providers: [PlanService, PlanRepository],
  exports: [PlanService, PlanRepository],
})
export class PlanModule {}
