import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class MealEntryQueryDto {
  @ApiProperty({
    example: '2026-09-24',
    description: 'Specific date to query meals for (YYYY-MM-DD or ISO 8601)',
  })
  @IsDateString(
    {},
    { message: 'date must be a valid ISO 8601 or YYYY-MM-DD date string' },
  )
  @IsNotEmpty({ message: 'date is required' })
  date: string;
}
