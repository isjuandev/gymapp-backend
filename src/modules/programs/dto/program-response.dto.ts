import { ApiProperty } from '@nestjs/swagger';
import {
  Program,
  ProgramCategory,
  ProgramLevel,
  ProgramLocation,
} from '@prisma/client';

export class ProgramResponseDto {
  @ApiProperty({
    example: '11111111-1111-1111-1111-111111111111',
    description: 'Unique program UUID',
  })
  id: string;

  @ApiProperty({
    example: 'Hipertrofia Total',
    description: 'Title of the program',
  })
  title: string;

  @ApiProperty({
    enum: ProgramCategory,
    example: ProgramCategory.MUSCLE_GAIN,
    description: 'Program category',
  })
  category: ProgramCategory;

  @ApiProperty({
    example: 8,
    description: 'Program duration in weeks',
  })
  durationWeeks: number;

  @ApiProperty({
    enum: ProgramLevel,
    example: ProgramLevel.INTERMEDIATE,
    description: 'Program difficulty level',
  })
  level: ProgramLevel;

  @ApiProperty({
    enum: ProgramLocation,
    example: ProgramLocation.GYM,
    description: 'Training location',
  })
  location: ProgramLocation;

  @ApiProperty({
    example: 'Gana masa muscular magra y fuerza progresiva',
    description: 'Program tagline',
  })
  tagline: string;

  @ApiProperty({
    example: 'program_hypertrophy',
    description: 'Local image asset name in the iOS bundle',
  })
  imageAssetName: string;

  static fromEntity(program: Program): ProgramResponseDto {
    return {
      id: program.id,
      title: program.title,
      category: program.category,
      durationWeeks: program.durationWeeks,
      level: program.level,
      location: program.location,
      tagline: program.tagline,
      imageAssetName: program.imageAssetName,
    };
  }
}
