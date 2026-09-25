import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class CreateWeightEntryDto {
  @ApiProperty({
    example: '2026-09-24T12:00:00.000Z',
    description: 'Timestamp or date of the weight weigh-in in ISO 8601 format',
  })
  @IsDateString({}, { message: 'date must be a valid ISO 8601 date string' })
  @IsNotEmpty({ message: 'date is required' })
  date: string;

  @ApiProperty({
    example: 78.5,
    description: 'Body weight in kilograms',
  })
  @IsNumber({}, { message: 'weightKg must be a number' })
  @IsPositive({ message: 'weightKg must be greater than 0' })
  weightKg: number;
}
