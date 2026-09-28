import { Module, forwardRef } from '@nestjs/common';
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
  // forwardRef: ProgramsModule -> PlanModule -> WorkoutsModule closes a loop
  // back to ProgramsModule; resolve it lazily (enroll = plan assignment).
  imports: [AuthModule, forwardRef(() => ProgramsModule), RecommendationModule],
  controllers: [WorkoutsController, ExercisesController],
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
