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
import { WorkoutsService } from './workouts.service';
import { ExercisesService } from './exercises.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { CreateCustomWorkoutDto } from './dto/create-custom-workout.dto';
import { UpdateCustomWorkoutDto } from './dto/update-custom-workout.dto';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { WorkoutResponseDto } from './dto/workout-response.dto';
import { WorkoutDetailResponseDto } from './dto/workout-detail-response.dto';
import { ExerciseResponseDto } from './dto/exercise-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Workouts')
@Controller('workouts')
export class WorkoutsController {
  constructor(
    private readonly workoutsService: WorkoutsService,
    private readonly exercisesService: ExercisesService,
  ) {}

  // ============================================================================
  // CUSTOM WORKOUTS (Static routes MUST precede parameterized :id)
  // ============================================================================

  @Post('custom')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a custom workout for authenticated user',
    description: 'Accepts only valid catalog exercise IDs. Sets ownerUserId to current user.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Custom workout successfully created',
    type: WorkoutDetailResponseDto,
  })
  async createCustomWorkout(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCustomWorkoutDto,
  ): Promise<WorkoutDetailResponseDto> {
    return this.workoutsService.createCustomWorkout(userId, dto);
  }

  @Get('custom')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List all custom workouts owned by authenticated user',
    description: 'Returns workouts with equipment-resolved exercises and isCustom: true',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of custom workouts',
    type: [WorkoutDetailResponseDto],
  })
  async getCustomWorkouts(
    @CurrentUser('userId') userId: string,
  ): Promise<WorkoutDetailResponseDto[]> {
    return this.workoutsService.getCustomWorkouts(userId);
  }

  @Patch('custom/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update a custom workout owned by authenticated user',
    description: 'Validates user ownership (403 if not owner)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Custom workout updated successfully',
    type: WorkoutDetailResponseDto,
  })
  async updateCustomWorkout(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomWorkoutDto,
  ): Promise<WorkoutDetailResponseDto> {
    return this.workoutsService.updateCustomWorkout(id, userId, dto);
  }

  @Delete('custom/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete a custom workout owned by authenticated user',
    description: 'Validates user ownership (403 if not owner)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Custom workout deleted successfully',
  })
  async deleteCustomWorkout(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.workoutsService.deleteCustomWorkout(id, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List workouts, optionally filtered by programId',
    description: 'Accessible by any authenticated member or admin',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of workouts',
    type: [WorkoutResponseDto],
  })
  async getWorkouts(
    @Query('programId') programId?: string,
  ): Promise<WorkoutResponseDto[]> {
    return this.workoutsService.getWorkouts(programId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get workout details with ordered exercises',
    description: 'Accessible by any authenticated member or admin',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workout details with exercises ordered by sequence',
    type: WorkoutDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workout not found',
  })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<WorkoutDetailResponseDto> {
    return this.workoutsService.getWorkoutById(id, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new workout (Admin only)',
    description: 'Validates that the referenced programId exists',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Workout successfully created',
    type: WorkoutResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Referenced program does not exist or invalid input',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async create(
    @Body() createWorkoutDto: CreateWorkoutDto,
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.createWorkout(createWorkoutDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update an existing workout (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workout successfully updated',
    type: WorkoutResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workout not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkoutDto: UpdateWorkoutDto,
  ): Promise<WorkoutResponseDto> {
    return this.workoutsService.updateWorkout(id, updateWorkoutDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete a workout (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workout deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workout not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.workoutsService.deleteWorkout(id);
  }

  @Post(':id/exercises')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an exercise to a workout (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Exercise added to workout successfully',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workout not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden: requires ADMIN role',
  })
  async addExercise(
    @Param('id', ParseUUIDPipe) workoutId: string,
    @Body() createExerciseDto: CreateExerciseDto,
  ): Promise<ExerciseResponseDto> {
    return this.exercisesService.addExercise(workoutId, createExerciseDto);
  }
}
