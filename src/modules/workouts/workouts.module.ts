import { Module } from '@nestjs/common';
import { CustomWorkoutsController } from './custom-workouts.controller';
import { WorkoutsController } from './workouts.controller';
import { ExercisesController } from './exercises.controller';
import { WorkoutsService } from './workouts.service';
import { ExercisesService } from './exercises.service';
import { WorkoutsRepository } from './repositories/workouts.repository';
import { ExercisesRepository } from './repositories/exercises.repository';
import { AuthModule } from '../auth/auth.module';
import { ProgramsModule } from '../programs/programs.module';
import { RecommendationModule } from '../recommendation/recommendation.module';

@Module({
  imports: [AuthModule, ProgramsModule, RecommendationModule],
  controllers: [CustomWorkoutsController, WorkoutsController, ExercisesController],
  providers: [
    WorkoutsService,
    ExercisesService,
    WorkoutsRepository,
    ExercisesRepository,
  ],
  exports: [
    WorkoutsService,
    ExercisesService,
    WorkoutsRepository,
    ExercisesRepository,
  ],
})
export class WorkoutsModule {}
