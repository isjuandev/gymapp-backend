import { Module } from '@nestjs/common';
import { CustomScheduleController } from './custom-schedule.controller';
import { CustomScheduleService } from './custom-schedule.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CustomScheduleController],
  providers: [CustomScheduleService],
  exports: [CustomScheduleService],
})
export class CustomScheduleModule {}
