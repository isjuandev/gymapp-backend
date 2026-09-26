import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CustomScheduleService } from './custom-schedule.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UpdateCustomScheduleDto } from './dto/update-custom-schedule.dto';
import { CustomScheduleDayDto } from './dto/custom-schedule-response.dto';
import { DayOfWeek } from '@prisma/client';

@ApiTags('Custom Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('custom-schedule')
export class CustomScheduleController {
  constructor(private readonly customScheduleService: CustomScheduleService) {}

  @Get()
  @ApiOperation({
    summary:
      'Retrieve the 7 weekday routine assignments for the authenticated user',
    description:
      'Always returns all 7 days (Monday through Sunday) in order. Days without explicit assignments have workoutId: null and isRestDay: false.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of 7 day schedule assignments',
    type: [CustomScheduleDayDto],
  })
  async getSchedule(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomScheduleDayDto[]> {
    return this.customScheduleService.getSchedule(user.userId);
  }

  @Put(':dayOfWeek')
  @ApiOperation({
    summary: 'Upsert the routine or rest assignment for a specific day of the week',
    description:
      'Assigns a custom workout or rest day to the specified weekday. Accepts { workoutId } or { isRestDay: true }. Rejects with 400 if both or neither are provided, or if workoutId does not belong to the user.',
  })
  @ApiParam({
    name: 'dayOfWeek',
    enum: DayOfWeek,
    description: 'Weekday to configure (e.g. MONDAY, TUESDAY)',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated weekday assignment',
    type: CustomScheduleDayDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error: both or neither workoutId and isRestDay provided, or workout does not belong to user',
  })
  @ApiResponse({
    status: 404,
    description: 'Workout with given ID not found',
  })
  async updateDaySchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dayOfWeek') rawDay: string,
    @Body() dto: UpdateCustomScheduleDto,
  ): Promise<CustomScheduleDayDto> {
    const normalizedDay = rawDay.toUpperCase() as DayOfWeek;
    if (!Object.values(DayOfWeek).includes(normalizedDay)) {
      throw new BadRequestException(
        `Invalid dayOfWeek '${rawDay}'. Must be one of: ${Object.values(DayOfWeek).join(', ')}`,
      );
    }

    return this.customScheduleService.updateDaySchedule(
      user.userId,
      normalizedDay,
      dto,
    );
  }
}
