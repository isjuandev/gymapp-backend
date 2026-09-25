import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class UpdateGoalDto {
  @ApiPropertyOptional({
    example: 75.0,
    description: 'Updated current progress metric value',
  })
  @IsOptional()
  @IsNumber({}, { message: 'currentValue must be a number' })
  @IsPositive({ message: 'currentValue must be greater than 0' })
  currentValue?: number;

  @ApiPropertyOptional({
    example: 68.0,
    description: 'Updated target metric value',
  })
  @IsOptional()
  @IsNumber({}, { message: 'targetValue must be a number' })
  @IsPositive({ message: 'targetValue must be greater than 0' })
  targetValue?: number;

  @ApiPropertyOptional({
    example: '2027-01-31T23:59:59.000Z',
    description: 'Updated deadline in ISO 8601 format',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'deadline must be a valid ISO 8601 date string' },
  )
  deadline?: string;
}
