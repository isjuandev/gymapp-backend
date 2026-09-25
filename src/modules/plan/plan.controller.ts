import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { PlanQueryDto } from './dto/plan-query.dto';
import { UpdatePlanDayDto } from './dto/update-plan-day.dto';
import { WeeklyPlanResponseDto } from './dto/weekly-plan-response.dto';
import { PlanDayResponseDto } from './dto/plan-day-response.dto';
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
