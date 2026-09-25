import { ApiProperty } from '@nestjs/swagger';
import { MealResponseDto } from './meal-response.dto';

export class MealEntryResponseDto {
  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Unique identifier for the meal entry',
  })
  id: string;

  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'User ID owner of this entry',
  })
  userId: string;

  @ApiProperty({
    example: '33333333-3333-4333-8333-333333333333',
    description: 'ID of the associated meal',
  })
  mealId: string;

  @ApiProperty({
    example: '2026-09-24T00:00:00.000Z',
    description: 'Date for which the meal is recorded in ISO 8601 UTC format',
  })
  date: string;

  @ApiProperty({
    example: true,
    description: 'Whether the meal was consumed',
  })
  consumed: boolean;

  @ApiProperty({
    type: MealResponseDto,
    description: 'Full meal entity details associated with this entry',
  })
  meal: MealResponseDto;
}
