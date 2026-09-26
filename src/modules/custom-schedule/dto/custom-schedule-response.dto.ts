import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';

export class CustomScheduleWorkoutSummaryDto {
  @ApiProperty({ example: '35077ba1-2004-4e72-8409-812ec0dc83f9' })
  id: string;

  @ApiProperty({ example: 'Pierna y Glúteo Custom' })
  title: string;

  @ApiPropertyOptional({ example: 45, nullable: true })
  durationMinutes?: number | null;

  @ApiPropertyOptional({ example: 250, nullable: true })
  kcalEstimate?: number | null;

  @ApiPropertyOptional({ example: 'workout_card_default', nullable: true })
  imageAssetName?: string | null;

  @ApiPropertyOptional({ example: 4 })
  exercisesCount?: number;
}

export class CustomScheduleDayDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
  })
  id?: string | null;

  @ApiProperty({ example: '2c3c8b2e-98eb-4ef4-a0f4-a6f4b37181f6' })
  userId: string;

  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  dayOfWeek: DayOfWeek;

  @ApiPropertyOptional({
    example: '35077ba1-2004-4e72-8409-812ec0dc83f9',
    nullable: true,
  })
  workoutId: string | null;

  @ApiProperty({ example: false })
  isRestDay: boolean;

  @ApiPropertyOptional({
    type: () => CustomScheduleWorkoutSummaryDto,
    nullable: true,
  })
  workout?: CustomScheduleWorkoutSummaryDto | null;
}
