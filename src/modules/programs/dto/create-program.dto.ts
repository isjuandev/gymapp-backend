import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
} from 'class-validator';
import { ProgramCategory, ProgramLevel, ProgramLocation } from '@prisma/client';

export class CreateProgramDto {
  @ApiProperty({
    example: 'Hipertrofia Total',
    description: 'Title of the fitness program',
  })
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title: string;

  @ApiProperty({
    enum: ProgramCategory,
    example: ProgramCategory.MUSCLE_GAIN,
    description: 'Target goal category of the program',
  })
  @IsEnum(ProgramCategory, {
    message: 'category must be one of: WEIGHT_LOSS, MUSCLE_GAIN, HEALTH',
  })
  category: ProgramCategory;

  @ApiProperty({
    example: 8,
    description: 'Duration in weeks',
  })
  @IsInt()
  @IsPositive({ message: 'durationWeeks must be greater than 0' })
  durationWeeks: number;

  @ApiProperty({
    enum: ProgramLevel,
    example: ProgramLevel.INTERMEDIATE,
    description: 'Difficulty level',
  })
  @IsEnum(ProgramLevel, {
    message: 'level must be one of: BEGINNER, INTERMEDIATE, ADVANCED',
  })
  level: ProgramLevel;

  @ApiProperty({
    enum: ProgramLocation,
    example: ProgramLocation.GYM,
    description: 'Workout location required for the program',
  })
  @IsEnum(ProgramLocation, {
    message: 'location must be one of: HOME, GYM, HOME_AND_GYM',
  })
  location: ProgramLocation;

  @ApiProperty({
    example: 'Gana masa muscular magra y fuerza progresiva',
    description: 'Short promotional tagline',
  })
  @IsString()
  @IsNotEmpty({ message: 'tagline is required' })
  tagline: string;

  @ApiProperty({
    example: 'program_hypertrophy',
    description: 'Image asset name bundled in the iOS app',
  })
  @IsString()
  @IsNotEmpty({ message: 'imageAssetName is required' })
  imageAssetName: string;
}
