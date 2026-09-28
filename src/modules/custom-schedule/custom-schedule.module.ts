import { Module } from '@nestjs/common';
import { CustomScheduleController } from './custom-schedule.controller';
import { CustomScheduleService } from './custom-schedule.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [PrismaModule, AuthModule, PlanModule],
  controllers: [CustomScheduleController],
  providers: [CustomScheduleService],
  exports: [CustomScheduleService],
})
export class CustomScheduleModule {}
