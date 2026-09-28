import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IntegrityService } from './integrity.service';
import {
  PlanConsistencyReportDto,
  PlanConsistencyRepairDto,
  PlanConsistencyRepairResultDto,
} from './dto/integrity-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/integrity')
export class AdminIntegrityController {
  constructor(private readonly integrityService: IntegrityService) {}

  @Get('plan-consistency')
  @ApiOperation({
    summary:
      'Report plan/schedule/goal consistency violations (invariants 1-5)',
    description:
      'Scans users and reports canonical-plan violations. Read-only. Intended to run after every deploy.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PlanConsistencyReportDto,
  })
  async report(
    @Query('limit') limit?: string,
  ): Promise<PlanConsistencyReportDto> {
    const parsed = limit
      ? Math.max(1, Math.min(5000, parseInt(limit, 10) || 500))
      : 500;
    const violations = await this.integrityService.checkAll(parsed);
    return {
      checkedUsers: parsed,
      violations,
      checkedAt: new Date().toISOString(),
    };
  }

  @Post('plan-consistency/repair')
  @ApiOperation({
    summary: 'Repair auto-fixable plan consistency violations (idempotent)',
    description:
      'Repairs through PlanService (single writer): assigns missing preset plans, rewrites mismatched preset schedules, aligns goals. Never deletes library workouts, sessions, weights or goal rows. dryRun=true (default) only reports what would change.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PlanConsistencyRepairResultDto,
  })
  async repair(
    @Body() dto: PlanConsistencyRepairDto,
  ): Promise<PlanConsistencyRepairResultDto> {
    const dryRun = dto.dryRun ?? true;
    const limit = dto.limit ? Math.max(1, Math.min(5000, dto.limit)) : 500;
    const actions = await this.integrityService.repairAll(limit, dryRun);
    const violations = await this.integrityService.checkAll(limit);
    return {
      dryRun,
      repaired: dryRun ? 0 : actions.filter((a) => a.ok).length,
      skipped: dryRun ? actions.length : actions.filter((a) => !a.ok).length,
      remaining: violations,
      actions,
    };
  }
}
