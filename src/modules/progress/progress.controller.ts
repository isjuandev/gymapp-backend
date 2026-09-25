import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import {
  CreateGoalDto,
  CreateWeightEntryDto,
  GoalResponseDto,
  ProgressStatsResponseDto,
  UpdateGoalDto,
  WeightEntryQueryDto,
  WeightEntryResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Progress')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('weight-entries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record or update daily body weight',
    description:
      'Creates a weight entry. If an entry already exists for that calendar date, updates it (upsert). If the active goal is LOSE_WEIGHT, automatically syncs goal currentValue.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Weight entry saved successfully',
    type: WeightEntryResponseDto,
  })
  async addWeightEntry(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateWeightEntryDto,
  ): Promise<WeightEntryResponseDto> {
    return this.progressService.addWeightEntry(userId, dto);
  }

  @Get('weight-entries')
  @ApiOperation({
    summary: 'Get weight entries within a predefined range',
    description:
      'Returns weigh-ins for 7D, 30D, 3M, 6M, or 1Y, sorted by date ascending.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Weight entries ordered by date ascending',
    type: [WeightEntryResponseDto],
  })
  async getWeightEntries(
    @CurrentUser('userId') userId: string,
    @Query() query: WeightEntryQueryDto,
  ): Promise<WeightEntryResponseDto[]> {
    return this.progressService.getWeightEntries(userId, query.range);
  }

  @Get('goals')
  @ApiOperation({
    summary: 'Get all fitness goals for the authenticated user',
    description: 'Returns all goals ordered by creation date descending.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of fitness goals',
    type: [GoalResponseDto],
  })
  async getAllGoals(
    @CurrentUser('userId') userId: string,
  ): Promise<GoalResponseDto[]> {
    return this.progressService.getAllGoals(userId);
  }

  @Get('goals/current')
  @ApiOperation({
    summary: 'Get the active fitness goal for the authenticated user',
    description:
      'Returns the most recent active goal without expired deadline, or most recent goal.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active goal details',
    type: GoalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active goal found',
  })
  async getCurrentGoal(
    @CurrentUser('userId') userId: string,
  ): Promise<GoalResponseDto> {
    return this.progressService.getCurrentGoal(userId);
  }

  @Post('goals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new fitness goal',
    description:
      'Creates a new goal which implicitly becomes the current active goal.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Goal created successfully',
    type: GoalResponseDto,
  })
  async createGoal(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.progressService.createGoal(userId, dto);
  }

  @Patch('goals/:id')
  @ApiOperation({
    summary: 'Update an existing fitness goal',
    description:
      'Updates currentValue, targetValue, and/or deadline. Validates user ownership.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Goal updated successfully',
    type: GoalResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Goal not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: not owner of this goal',
  })
  async updateGoal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.progressService.updateGoal(userId, id, dto);
  }

  @Delete('goals/:id')
  @ApiOperation({
    summary: 'Delete a fitness goal',
    description: 'Deletes a goal. Validates user ownership.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Goal deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Goal not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: not owner of this goal',
  })
  async deleteGoal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.progressService.deleteGoal(userId, id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get progress dashboard monthly metrics',
    description:
      'Aggregates total completed workouts and active time (in seconds) for the current calendar month.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Aggregated monthly progress stats',
    type: ProgressStatsResponseDto,
  })
  async getProgressStats(
    @CurrentUser('userId') userId: string,
  ): Promise<ProgressStatsResponseDto> {
    return this.progressService.getProgressStats(userId);
  }
}
