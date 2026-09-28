import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingRepository } from './repositories/onboarding.repository';
import { AuthModule } from '../auth/auth.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [AuthModule, EquipmentModule, PlanModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingRepository],
  exports: [OnboardingService, OnboardingRepository],
})
export class OnboardingModule {}
