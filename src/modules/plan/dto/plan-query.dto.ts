import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class PlanQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-21',
    description:
      'Date of the target week (ISO string or YYYY-MM-DD). Normalized to the Monday of that week.',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'weekStartDate must be a valid date string (e.g. YYYY-MM-DD)' },
  )
  weekStartDate?: string;
}
