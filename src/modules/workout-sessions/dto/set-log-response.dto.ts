import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseSetLog } from '@prisma/client';

export class SetLogResponseDto {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333331' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222221' })
  workoutSessionId: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  exerciseId: string;

  @ApiProperty({ example: 1 })
  setNumber: number;

  @ApiProperty({ example: 40.0 })
  weightKg: number;

  @ApiProperty({ example: 12 })
  reps: number;

  @ApiProperty({ example: false })
  isWarmup: boolean;

  @ApiPropertyOptional({ example: 8.5 })
  rpe: number | null;

  @ApiProperty({ example: '2026-09-25T14:30:00.000Z' })
  completedAt: Date;

  static fromEntity(entity: ExerciseSetLog): SetLogResponseDto {
    const dto = new SetLogResponseDto();
    dto.id = entity.id;
    dto.workoutSessionId = entity.workoutSessionId;
    dto.exerciseId = entity.exerciseId;
    dto.setNumber = entity.setNumber;
    dto.weightKg = Number(entity.weightKg);
    dto.reps = entity.reps;
    dto.isWarmup = entity.isWarmup;
    dto.rpe = entity.rpe !== null ? Number(entity.rpe) : null;
    dto.completedAt = entity.completedAt;
    return dto;
  }
}
