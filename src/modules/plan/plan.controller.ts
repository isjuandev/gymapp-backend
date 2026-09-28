import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { PlanQueryDto } from './dto/plan-query.dto';
import { UpdatePlanDayDto } from './dto/update-plan-day.dto';
import { WeeklyPlanResponseDto } from './dto/weekly-plan-response.dto';
import { PlanDayResponseDto } from './dto/plan-day-response.dto';
import { PlanStateResponseDto } from './dto/plan-state-response.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Plan')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('plan')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get weekly plan for current week (Mon..Sun)',
    description:
      'Calculates Monday of current week. Auto-generates from previous pattern or rest-day baseline if missing.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Weekly plan with 7 days and associated workouts',
    type: WeeklyPlanResponseDto,
  })
  async getCurrent(
    @CurrentUser('userId') userId: string,
  ): Promise<WeeklyPlanResponseDto> {
    return this.planService.getCurrentPlan(userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get weekly plan for a specific week',
    description:
      'Normalized to the Monday of the requested week. Used for calendar navigation.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Weekly plan for the specified week',
    type: WeeklyPlanResponseDto,
  })
  async getByWeek(
    @CurrentUser('userId') userId: string,
    @Query() query: PlanQueryDto,
  ): Promise<WeeklyPlanResponseDto> {
    return this.planService.getPlanByWeek(userId, query.weekStartDate);
  }

  @Post('regenerate')
  @ApiOperation({
    summary: 'Force regenerate weekly plan for current week or specified week',
    description:
      'Recalculates workout rotation and distribution based on current program and profile.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Regenerated weekly plan with varied workouts',
    type: WeeklyPlanResponseDto,
  })
  async regenerate(
    @CurrentUser('userId') userId: string,
    @Query() query: PlanQueryDto,
  ): Promise<WeeklyPlanResponseDto> {
    return this.planService.regenerateWeeklyPlan(userId, query.weekStartDate);
  }

  @Get('state')
  @ApiOperation({
    summary: 'Single canonical plan/week/today state (Fase 2 consistency)',
    description:
      'One read model for ALL screens (Home, Mi Plan, Mis Rutinas > Horario, tab Plan): active plan metadata, materialized 7-day schedule and today card derived ONLY from that schedule. No active plan returns HTTP 200 with state "none" (never 404): clients show the pick-a-plan CTA.',
  })
  @ApiHeader({
    name: 'X-Timezone',
    required: false,
    description:
      'User IANA timezone identifier (e.g. America/Bogota, Europe/Madrid). Defaults to UTC if omitted or invalid.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Canonical plan state',
    type: PlanStateResponseDto,
  })
  async getState(
    @CurrentUser('userId') userId: string,
    @Headers('x-timezone') timezoneHeader?: string,
  ): Promise<PlanStateResponseDto> {
    return this.planService.getPlanState(userId, timezoneHeader);
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign a preset plan (change plan) in one transaction',
    description:
      'Single writer for preset plans: fixes the canonical UserPlan row, aligns User goal + Goal rows (nutritional objective), regenerates the WeeklyPlan and rewrites the single schedule. Replaces the derived schedule but never deletes the workout library or history.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Assigned plan state',
    type: PlanStateResponseDto,
  })
  async assign(
    @CurrentUser('userId') userId: string,
    @Body() dto: AssignPlanDto,
  ): Promise<PlanStateResponseDto> {
    const { state } = await this.planService.assignPlan(userId, dto.programId);
    return state;
  }

  @Patch('days/:planDayId')
  @ApiOperation({
    summary: 'Manually reschedule a plan day or toggle rest day',
    description:
      'Allows changing assigned workoutId or setting isRestDay: true. Validates ownership.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan day updated successfully',
    type: PlanDayResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Plan day or assigned workout not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: not owner of this plan',
  })
  async updateDay(
    @Param('planDayId', ParseUUIDPipe) planDayId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePlanDayDto,
  ): Promise<PlanDayResponseDto> {
    return this.planService.updatePlanDay(planDayId, userId, dto);
  }
}
