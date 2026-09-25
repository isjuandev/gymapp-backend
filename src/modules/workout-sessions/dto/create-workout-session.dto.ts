import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateWorkoutSessionDto {
  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222221',
    description: 'UUID of the workout to start',
  })
  @IsUUID('all', { message: 'workoutId must be a valid UUID' })
  @IsNotEmpty({ message: 'workoutId is required' })
  workoutId: string;
}
