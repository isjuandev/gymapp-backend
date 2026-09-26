import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { CreateCustomWorkoutDto } from './dto/create-custom-workout.dto';
import { UpdateCustomWorkoutDto } from './dto/update-custom-workout.dto';
import { WorkoutDetailResponseDto } from './dto/workout-detail-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Custom Workouts')
@Controller('workouts/custom')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CustomWorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a custom workout for the authenticated user',
    description: 'Accepts only valid catalog exercise IDs. Sets ownerUserId to current user.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Custom workout successfully created',
    type: WorkoutDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or catalog exercise not found',
  })
  async createCustomWorkout(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCustomWorkoutDto,
  ): Promise<WorkoutDetailResponseDto> {
    return this.workoutsService.createCustomWorkout(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all custom workouts owned by the authenticated user',
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a custom workout owned by the authenticated user',
    description: 'Validates user ownership (403 if not owner)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Custom workout updated successfully',
    type: WorkoutDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not the owner of the workout',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workout not found',
  })
  async updateCustomWorkout(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomWorkoutDto,
  ): Promise<WorkoutDetailResponseDto> {
    return this.workoutsService.updateCustomWorkout(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a custom workout owned by the authenticated user',
    description: 'Validates user ownership (403 if not owner)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Custom workout deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not the owner of the workout',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Workout not found',
  })
  async deleteCustomWorkout(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.workoutsService.deleteCustomWorkout(id, userId);
  }
}
