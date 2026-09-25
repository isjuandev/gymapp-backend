import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingRepository } from './repositories/onboarding.repository';
import { AuthModule } from '../auth/auth.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { RecommendationModule } from '../recommendation/recommendation.module';

@Module({
  imports: [AuthModule, EquipmentModule, RecommendationModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingRepository],
  exports: [OnboardingService, OnboardingRepository],
})
export class OnboardingModule {}
