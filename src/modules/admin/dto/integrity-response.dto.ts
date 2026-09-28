import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type IntegritySeverity = 'high' | 'medium' | 'low';

export class PlanConsistencyViolationDto {
  @ApiProperty({ example: 'user-uuid-1111' })
  userId: string;

  @ApiProperty({ example: 'NO_USER_PLAN_WITH_COMPLETE_ONBOARDING' })
  code: string;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'high' })
  severity: IntegritySeverity;

  @ApiProperty({
    example:
      'Onboarding is complete but the user has no canonical UserPlan row',
  })
  message: string;

  @ApiProperty({ example: true })
  autoFixable: boolean;
}

export class PlanConsistencyReportDto {
  @ApiProperty({ example: 42 })
  checkedUsers: number;

  @ApiProperty({ type: () => [PlanConsistencyViolationDto] })
  violations: PlanConsistencyViolationDto[];

  @ApiProperty({ example: '2026-09-28T12:00:00.000Z' })
  checkedAt: string;
}

export class PlanConsistencyRepairDto {
  @ApiPropertyOptional({
    example: true,
    description:
      'true (default): only report what WOULD be repaired. false: apply repairs.',
  })
  dryRun?: boolean;

  @ApiPropertyOptional({
    example: 100,
    description: 'Max users to scan',
  })
  limit?: number;
}

export class PlanConsistencyRepairResultDto {
  @ApiProperty({ example: true })
  dryRun: boolean;

  @ApiProperty({ example: 3 })
  repaired: number;

  @ApiProperty({ example: 1 })
  skipped: number;

  @ApiProperty({ type: () => [PlanConsistencyViolationDto] })
  remaining: PlanConsistencyViolationDto[];

  @ApiProperty({
    example: [{ userId: 'user-uuid-1', action: 'assignPlan', ok: true }],
  })
  actions: { userId: string; action: string; ok: boolean; error?: string }[];
}
