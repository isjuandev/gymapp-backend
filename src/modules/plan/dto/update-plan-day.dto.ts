import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PlanDayStatus } from '@prisma/client';

export class UpdatePlanDayDto {
  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222221',
    description: 'Workout UUID to assign to this day, or null for rest day',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsUUID('all', { message: 'workoutId must be a valid UUID or null' })
  workoutId?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this day is designated as a rest day',
  })
  @IsOptional()
  @IsBoolean({ message: 'isRestDay must be a boolean' })
  isRestDay?: boolean;

  @ApiPropertyOptional({
    enum: PlanDayStatus,
    example: PlanDayStatus.UPCOMING,
    description: 'Status of the planned day',
  })
  @IsOptional()
  @IsEnum(PlanDayStatus, {
    message: 'status must be UPCOMING, COMPLETED, or MISSED',
  })
  status?: PlanDayStatus;
}
