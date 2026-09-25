import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CreateActivityDailySnapshotDto } from './create-activity-snapshot.dto';

export class BatchActivitySnapshotsDto {
  @ApiProperty({
    type: [CreateActivityDailySnapshotDto],
    description: 'Array of activity daily snapshots to record',
  })
  @IsArray({ message: 'snapshots must be an array' })
  @ArrayNotEmpty({ message: 'snapshots array must not be empty' })
  @ValidateNested({ each: true })
  @Type(() => CreateActivityDailySnapshotDto)
  snapshots: CreateActivityDailySnapshotDto[];
}
