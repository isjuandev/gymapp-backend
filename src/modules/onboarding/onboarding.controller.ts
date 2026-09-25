import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto, OnboardingProfileResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Onboarding')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get completed onboarding profile of authenticated user',
    description:
      'Returns the onboarding profile if completed, or 404 if not yet completed.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Onboarding profile found and completed',
    type: OnboardingProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Onboarding profile does not exist or is incomplete',
  })
  async getProfile(
    @CurrentUser('userId') userId: string,
  ): Promise<OnboardingProfileResponseDto> {
    return this.onboardingService.getProfile(userId);
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit and complete initial user onboarding questionnaire',
    description:
      'Persists user goal, experience level, workout days per week, and equipment preferences, marking completedAt timestamp and triggering initial weekly plan generation.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Onboarding successfully completed',
    type: OnboardingProfileResponseDto,
  })
  async completeOnboarding(
    @CurrentUser('userId') userId: string,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<OnboardingProfileResponseDto> {
    return this.onboardingService.completeOnboarding(userId, dto);
  }
}
