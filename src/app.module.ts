import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { WorkoutSessionsModule } from './modules/workout-sessions/workout-sessions.module';
import { PlanModule } from './modules/plan/plan.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ActivityModule } from './modules/activity/activity.module';
import { NutritionModule } from './modules/nutrition/nutrition.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    ProgramsModule,
    WorkoutsModule,
    WorkoutSessionsModule,
    PlanModule,
    ProgressModule,
    ActivityModule,
    NutritionModule,
    EquipmentModule,
    OnboardingModule,
    RecommendationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
