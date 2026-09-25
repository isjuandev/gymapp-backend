import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum WeightRangeFilter {
  SEVEN_DAYS = '7D',
  THIRTY_DAYS = '30D',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
}

export class WeightEntryQueryDto {
  @ApiPropertyOptional({
    enum: WeightRangeFilter,
    default: WeightRangeFilter.THIRTY_DAYS,
    description:
      'Preset time horizon to calculate start date on backend (7D, 30D, 3M, 6M, 1Y)',
    example: WeightRangeFilter.THIRTY_DAYS,
  })
  @IsOptional()
  @IsEnum(WeightRangeFilter, {
    message: 'range must be one of: 7D, 30D, 3M, 6M, 1Y',
  })
  range?: WeightRangeFilter = WeightRangeFilter.THIRTY_DAYS;
}
