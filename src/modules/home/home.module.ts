import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { AuthModule } from '../auth/auth.module';
import { WorkoutsModule } from '../workouts/workouts.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [AuthModule, WorkoutsModule, PlanModule],
  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}
