import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateWorkoutDto {
  @ApiProperty({
    example: '11111111-1111-1111-1111-111111111111',
    description: 'UUID of the program this workout belongs to',
  })
  @IsUUID('all', { message: 'programId must be a valid UUID' })
  programId: string;

  @ApiProperty({
    example: 'Pecho & Tríceps Power',
    description: 'Title of the workout',
  })
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title: string;

  @ApiProperty({
    example: 50,
    description: 'Estimated duration in minutes',
  })
  @IsInt()
  @IsPositive({ message: 'durationMinutes must be a positive integer' })
  durationMinutes: number;

  @ApiProperty({
    example: 'Intermedio',
    description: 'Difficulty description',
  })
  @IsString()
  @IsNotEmpty({ message: 'difficulty is required' })
  difficulty: string;

  @ApiProperty({
    example: 420,
    description: 'Estimated calories burned',
  })
  @IsInt()
  @IsPositive({ message: 'kcalEstimate must be a positive integer' })
  kcalEstimate: number;

  @ApiProperty({
    example: 'workout_chest_triceps',
    description: 'Image asset name in the iOS bundle',
  })
  @IsString()
  @IsNotEmpty({ message: 'imageAssetName is required' })
  imageAssetName: string;

  @ApiProperty({
    example: 4,
    description: 'Number of rounds or circuits',
  })
  @IsInt()
  @IsPositive({ message: 'rounds must be a positive integer' })
  rounds: number;
}
