import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { UsersEquipmentPreferencesController } from './users-equipment-preferences.controller';
import { EquipmentService } from './equipment.service';
import { EquipmentRepository } from './repositories/equipment.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EquipmentController, UsersEquipmentPreferencesController],
  providers: [EquipmentService, EquipmentRepository],
  exports: [EquipmentService, EquipmentRepository],
})
export class EquipmentModule {}
