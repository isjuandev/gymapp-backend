import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import { WorkoutDetailResponseDto } from '../../workouts/dto/workout-detail-response.dto';

export type TodayWorkoutSource = 'custom' | 'recommended' | 'restDay' | 'none';

export class TodayWorkoutResponseDto {
  @ApiProperty({
    enum: ['custom', 'recommended', 'restDay', 'none'],
    example: 'custom',
    description:
      'Resolution source: custom (from custom schedule), recommended (from weekly plan engine), restDay (configured or recommended rest day), none (no plan or onboarding completed)',
  })
  source: TodayWorkoutSource;

  @ApiPropertyOptional({
    type: () => WorkoutDetailResponseDto,
    description:
      'Full workout detail with exercises resolved for the user (present when source is custom or recommended)',
    nullable: true,
  })
  workout?: WorkoutDetailResponseDto;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    example: DayOfWeek.SATURDAY,
    description: 'Day of week calculated according to user timezone',
  })
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({
    example: 'America/Bogota',
    description: 'Effective timezone used to resolve today (defaults to UTC)',
  })
  timezone?: string;
}
