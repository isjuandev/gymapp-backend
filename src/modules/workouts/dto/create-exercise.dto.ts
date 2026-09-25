import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExerciseKindDto {
  @ApiProperty({
    enum: ['reps', 'duration'],
    example: 'reps',
    description: 'Exercise measurement kind',
  })
  @IsEnum(['reps', 'duration'], {
    message: "kind.type must be either 'reps' or 'duration'",
  })
  type: 'reps' | 'duration';

  @ApiPropertyOptional({
    example: 10,
    description: "Number of repetitions when type is 'reps'",
  })
  @IsOptional()
  @IsInt()
  @IsPositive({ message: 'kind.count must be a positive integer' })
  count?: number;

  @ApiPropertyOptional({
    example: 45,
    description: "Duration in seconds when type is 'duration'",
  })
  @IsOptional()
  @IsInt()
  @IsPositive({ message: 'kind.seconds must be a positive integer' })
  seconds?: number;
}

export class CreateExerciseDto {
  @ApiProperty({
    example: 'Press de Banca Plano con Barra',
    description: 'Name of the exercise',
  })
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @ApiProperty({
    example: 1,
    description: 'Order of exercise within the workout',
  })
  @IsInt()
  @Min(0, { message: 'order must be a non-negative integer' })
  order: number;

  @ApiProperty({
    type: () => ExerciseKindDto,
    description: 'Kind of exercise target (repetitions or duration)',
    example: { type: 'reps', count: 10 },
  })
  @ValidateNested()
  @Type(() => ExerciseKindDto)
  kind: ExerciseKindDto;

  @ApiProperty({
    example: 'ex_bench_press',
    description: 'Image asset name in the iOS bundle',
  })
  @IsString()
  @IsNotEmpty({ message: 'imageAssetName is required' })
  imageAssetName: string;
}
