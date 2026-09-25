import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProgramCategory } from '@prisma/client';

export class ProgramFilterDto {
  @ApiPropertyOptional({
    enum: ProgramCategory,
    description: 'Filter programs by category',
    example: ProgramCategory.WEIGHT_LOSS,
  })
  @IsOptional()
  @IsEnum(ProgramCategory, {
    message: 'category must be one of: WEIGHT_LOSS, MUSCLE_GAIN, HEALTH',
  })
  category?: ProgramCategory;
}
