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
import { WorkoutSessionsService } from './workout-sessions.service';
import { CreateWorkoutSessionDto } from './dto/create-workout-session.dto';
import { CompleteWorkoutSessionDto } from './dto/complete-workout-session.dto';
import { WorkoutSessionFilterDto } from './dto/workout-session-filter.dto';
import { WorkoutSessionResponseDto } from './dto/workout-session-response.dto';
import { CreateSetLogDto } from './dto/create-set-log.dto';
import { SetLogResponseDto } from './dto/set-log-response.dto';
import { ExerciseProgressResponseDto } from './dto/exercise-progress-response.dto';
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

  // ============================================================================
  // PROGRESS ROUTES (Defined before :id routes to prevent route conflict)
  // ============================================================================

  @Get('user/progress')
  @ApiOperation({
    summary: 'Get all exercise progress states for the authenticated user',
    description:
      'Returns progressive overload status, working weights, and suggestions for all exercises practiced',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of exercise progress states',
    type: [ExerciseProgressResponseDto],
  })
  async getUserProgress(
    @CurrentUser('userId') userId: string,
  ): Promise<ExerciseProgressResponseDto[]> {
    return this.workoutSessionsService.getUserAllProgress(userId);
  }

  @Get('exercises/:exerciseId/progress')
  @ApiOperation({
    summary: 'Get progressive overload status and suggested next weight for an exercise',
    description:
      'Returns current working weight, consecutive sessions at target, and suggested increment if mastered',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exercise progress status and weight suggestions',
    type: ExerciseProgressResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  async getExerciseProgress(
    @CurrentUser('userId') userId: string,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ): Promise<ExerciseProgressResponseDto> {
    return this.workoutSessionsService.getExerciseProgress(userId, exerciseId);
  }

  // ============================================================================
  // SESSION SETS ROUTES
  // ============================================================================

  @Post(':id/sets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Log a completed set during an active workout session',
    description:
      'Records set number, weight, reps, warmup flag, and optional RPE for an exercise',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Set logged successfully',
    type: SetLogResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session or Exercise not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Session is not IN_PROGRESS',
  })
  async addSetLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSetLogDto,
  ): Promise<SetLogResponseDto> {
    return this.workoutSessionsService.addSetLog(id, userId, dto);
  }

  @Get(':id/sets')
  @ApiOperation({
    summary: 'Get all sets logged for a workout session',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of sets recorded in the session',
    type: [SetLogResponseDto],
  })
  async getSessionSets(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<SetLogResponseDto[]> {
    return this.workoutSessionsService.getSessionSets(id, userId);
  }

  @Delete(':id/sets/:setId')
  @ApiOperation({
    summary: 'Delete a set log from an in-progress workout session',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Set log deleted successfully',
  })
  async deleteSetLog(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('setId', ParseUUIDPipe) setId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.workoutSessionsService.deleteSetLog(id, setId, userId);
  }

  // ============================================================================
  // SESSION ACTIONS & LOOKUP
  // ============================================================================

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Complete an in-progress workout session',
    description:
      'Records duration, calories, heart rate, updates plan day, and evaluates progressive overload for logged sets.',
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
