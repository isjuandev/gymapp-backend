import {
  Controller,
  Get,
  Headers,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { HomeService } from './home.service';
import { TodayWorkoutResponseDto } from './dto/today-workout-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Home')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('today-workout')
  @ApiOperation({
    summary: "Resolve today's workout for the Home screen card",
    description:
      "Calculates today's day of week according to user timezone (X-Timezone header or UTC default). " +
      'Resolves workout by priority: 1) CustomRoutineDayAssignment (custom workout or restDay), ' +
      '2) Recommended WeeklyPlan PlanDay (recommended workout or restDay), ' +
      '3) none if user has no schedule or onboarding completed.',
  })
  @ApiHeader({
    name: 'X-Timezone',
    required: false,
    description:
      'User IANA timezone identifier (e.g. America/Bogota, Europe/Madrid). Defaults to UTC if omitted or invalid.',
    example: 'America/Bogota',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Today's resolved workout card details",
    type: TodayWorkoutResponseDto,
  })
  async getTodayWorkout(
    @CurrentUser('userId') userId: string,
    @Headers('x-timezone') timezoneHeader?: string,
  ): Promise<TodayWorkoutResponseDto> {
    return this.homeService.getTodayWorkout(userId, timezoneHeader);
  }
}
