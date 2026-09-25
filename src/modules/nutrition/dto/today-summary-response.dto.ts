import { ApiProperty } from '@nestjs/swagger';
import { MealEntryResponseDto } from './meal-entry-response.dto';

export class TodaySummaryResponseDto {
  @ApiProperty({
    example: 1850,
    description:
      'Total kilocalories across all meals planned/recorded for today',
  })
  totalKcal: number;

  @ApiProperty({
    type: [MealEntryResponseDto],
    description: 'List of meal entries for today with meal details included',
  })
  entries: MealEntryResponseDto[];
}
