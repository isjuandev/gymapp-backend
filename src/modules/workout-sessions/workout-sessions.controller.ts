import {
  Controller,
  Get,
  Post,
  Patch,
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
import { WorkoutSessionsService } from './workout-sessions.service';
import { CreateWorkoutSessionDto } from './dto/create-workout-session.dto';
import { CompleteWorkoutSessionDto } from './dto/complete-workout-session.dto';
import { WorkoutSessionFilterDto } from './dto/workout-session-filter.dto';
import { WorkoutSessionResponseDto } from './dto/workout-session-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Workout Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workout-sessions')
export class WorkoutSessionsController {
  constructor(
    private readonly workoutSessionsService: WorkoutSessionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a workout session (IN_PROGRESS)',
    description:
      'Creates a session using the authenticated userId extracted directly from the JWT',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Workout session created and in progress',
    type: WorkoutSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Referenced workout does not exist',
  })
  async startSession(
    @CurrentUser('userId') userId: string,
    @Body() createDto: CreateWorkoutSessionDto,
  ): Promise<WorkoutSessionResponseDto> {
    return this.workoutSessionsService.startSession(userId, createDto);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Complete an in-progress workout session',
    description:
      'Records duration, calories, and average heart rate. Rejects with 409 if not IN_PROGRESS.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workout session completed successfully',
    type: WorkoutSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: not owner of this session',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Conflict: session was already completed or skipped',
  })
  async completeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() completeDto: CompleteWorkoutSessionDto,
  ): Promise<WorkoutSessionResponseDto> {
    return this.workoutSessionsService.completeSession(id, userId, completeDto);
  }

  @Patch(':id/skip')
  @ApiOperation({
    summary: 'Mark a workout session as skipped',
    description:
      'Flags the session as SKIPPED. Cannot skip completed sessions.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workout session marked as skipped',
    type: WorkoutSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: not owner of this session',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Conflict: session already completed',
  })
  async skipSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<WorkoutSessionResponseDto> {
    return this.workoutSessionsService.skipSession(id, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get session history of the authenticated user',
    description: 'Filterable by from and to ISO 8601 date range',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of sessions ordered by date descending',
    type: [WorkoutSessionResponseDto],
  })
  async getHistory(
    @CurrentUser('userId') userId: string,
    @Query() filter: WorkoutSessionFilterDto,
  ): Promise<WorkoutSessionResponseDto[]> {
    return this.workoutSessionsService.getUserSessions(userId, filter);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details of a specific workout session',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workout session details',
    type: WorkoutSessionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: not owner of this session',
  })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<WorkoutSessionResponseDto> {
    return this.workoutSessionsService.getSessionById(id, userId);
  }
}
