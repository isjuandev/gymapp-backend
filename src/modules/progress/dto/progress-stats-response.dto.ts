import { ApiProperty } from '@nestjs/swagger';

export class ProgressStatsResponseDto {
  @ApiProperty({
    example: 12,
    description: 'Number of completed workouts in the current calendar month',
  })
  workoutsThisMonth: number;

  @ApiProperty({
    example: 21600,
    description:
      'Total active time in seconds across completed workouts in the current calendar month',
  })
  activeTimeThisMonth: number;
}
