import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import {
  ActivityDailySnapshotResponseDto,
  ActivitySnapshotQueryDto,
  CreateActivityDailySnapshotDto,
} from './dto';
import { BatchSnapshotsPipe } from './pipes/batch-snapshots.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Activity')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('snapshots')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Backup daily HealthKit activity snapshot',
    description:
      'Stores or updates (upsert by userId + date) a daily snapshot from device HealthKit sensors. Acts as multi-device backup without modifying sensor metrics.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Snapshot created or updated successfully',
    type: ActivityDailySnapshotResponseDto,
  })
  async createSnapshot(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateActivityDailySnapshotDto,
  ): Promise<ActivityDailySnapshotResponseDto> {
    return this.activityService.createSnapshot(userId, dto);
  }

  @Post('snapshots/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Batch sync multiple daily activity snapshots',
    description:
      'Synchronizes an accumulated array of daily snapshots in a single transactional call. Either all are saved, or none are.',
  })
  @ApiBody({
    type: [CreateActivityDailySnapshotDto],
    description:
      'Array of daily snapshots or object containing a `snapshots` array',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'All snapshots successfully saved in transaction',
    type: [ActivityDailySnapshotResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or validation failed on snapshot item',
  })
  async createSnapshotsBatch(
    @CurrentUser('userId') userId: string,
    @Body(BatchSnapshotsPipe) dtos: CreateActivityDailySnapshotDto[],
  ): Promise<ActivityDailySnapshotResponseDto[]> {
    return this.activityService.createSnapshotsBatch(userId, dtos);
  }

  @Get('snapshots')
  @ApiOperation({
    summary: 'Get historical activity snapshots by date range',
    description:
      'Retrieves snapshots for the authenticated user between from and to dates. Used for device restore or historical analytics fallback.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of snapshots matching the date filter',
    type: [ActivityDailySnapshotResponseDto],
  })
  async getSnapshots(
    @CurrentUser('userId') userId: string,
    @Query() query: ActivitySnapshotQueryDto,
  ): Promise<ActivityDailySnapshotResponseDto[]> {
    return this.activityService.getSnapshots(userId, query);
  }
}
