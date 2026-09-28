import { Module } from '@nestjs/common';
import { AdminIntegrityController } from './integrity.controller';
import { IntegrityService } from './integrity.service';
import { AuthModule } from '../auth/auth.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [AuthModule, PlanModule],
  controllers: [AdminIntegrityController],
  providers: [IntegrityService],
})
export class AdminModule {}
