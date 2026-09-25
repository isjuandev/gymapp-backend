import { ApiProperty } from '@nestjs/swagger';

export class WeightEntryResponseDto {
  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Unique identifier for the weight entry',
  })
  id: string;

  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'User ID of the entry owner',
  })
  userId: string;

  @ApiProperty({
    example: '2026-09-24T00:00:00.000Z',
    description: 'Weigh-in date in ISO 8601 UTC format',
  })
  date: string;

  @ApiProperty({
    example: 78.5,
    description: 'Recorded body weight in kilograms',
  })
  weightKg: number;

  @ApiProperty({
    example: '2026-09-24T12:00:00.000Z',
    description: 'Timestamp when the entry was created',
  })
  createdAt: string;
}
