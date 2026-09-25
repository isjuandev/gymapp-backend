import { Module } from '@nestjs/common';
import { WorkoutSessionsController } from './workout-sessions.controller';
import { WorkoutSessionsService } from './workout-sessions.service';
import { WorkoutSessionsRepository } from './repositories/workout-sessions.repository';
import { AuthModule } from '../auth/auth.module';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [AuthModule, WorkoutsModule],
  controllers: [WorkoutSessionsController],
  providers: [WorkoutSessionsService, WorkoutSessionsRepository],
  exports: [WorkoutSessionsService, WorkoutSessionsRepository],
})
export class WorkoutSessionsModule {}
