import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateMealEntryDto {
  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'ID of the meal being recorded or planned',
  })
  @IsUUID('4', { message: 'mealId must be a valid UUID' })
  @IsNotEmpty({ message: 'mealId is required' })
  mealId: string;

  @ApiProperty({
    example: '2026-09-24T00:00:00.000Z',
    description: 'Date of the meal in ISO 8601 or YYYY-MM-DD format',
  })
  @IsDateString({}, { message: 'date must be a valid ISO 8601 date string' })
  @IsNotEmpty({ message: 'date is required' })
  date: string;

  @ApiProperty({
    example: true,
    description: 'Whether the meal has been eaten/consumed',
  })
  @IsBoolean({ message: 'consumed must be a boolean' })
  @IsNotEmpty({ message: 'consumed is required' })
  consumed: boolean;
}
