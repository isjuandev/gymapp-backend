import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalType } from '@prisma/client';

export class GoalResponseDto {
  @ApiProperty({
    example: '11111111-1111-4111-8111-111111111111',
    description: 'Unique identifier for the goal',
  })
  id: string;

  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'User ID of the goal owner',
  })
  userId: string;

  @ApiProperty({
    enum: GoalType,
    example: GoalType.LOSE_WEIGHT,
    description: 'Type of goal',
  })
  type: GoalType;

  @ApiProperty({
    example: 70.0,
    description: 'Target metric value to reach',
  })
  targetValue: number;

  @ApiProperty({
    example: 78.5,
    description: 'Current tracked metric value',
  })
  currentValue: number;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    nullable: true,
    description: 'Optional target completion deadline in ISO 8601 format',
  })
  deadline: string | null;

  @ApiProperty({
    example: '2026-09-24T12:00:00.000Z',
    description: 'Timestamp when the goal was created',
  })
  createdAt: string;
}
