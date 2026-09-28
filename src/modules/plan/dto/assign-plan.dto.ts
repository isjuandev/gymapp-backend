import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignPlanDto {
  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    description:
      'Preset program UUID to assign. Omitted: the engine resolves the program from the onboarding goal/level (onboarding path).',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', { message: 'programId must be a valid UUID v4' })
  programId?: string;
}
