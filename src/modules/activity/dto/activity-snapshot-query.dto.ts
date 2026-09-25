import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ActivitySnapshotQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-01T00:00:00.000Z',
    description: 'Filter activity snapshots starting from this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO 8601 date string' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30T23:59:59.999Z',
    description: 'Filter activity snapshots up to this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO 8601 date string' })
  to?: string;
}
