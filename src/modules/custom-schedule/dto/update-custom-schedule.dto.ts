import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateCustomScheduleDto {
  @ApiPropertyOptional({
    description:
      'UUID of the custom workout belonging to the authenticated user. Must be null/omitted if isRestDay is true.',
    example: '35077ba1-2004-4e72-8409-812ec0dc83f9',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  workoutId?: string | null;

  @ApiPropertyOptional({
    description:
      'Whether this day is configured as a rest day. Must be false or omitted if workoutId is provided.',
    example: false,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isRestDay?: boolean;
}
