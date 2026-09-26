import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSetLogDto } from './create-set-log.dto';

export class BatchCreateSetLogsDto {
  @ApiProperty({
    type: [CreateSetLogDto],
    description: 'Array of completed sets to record in a single atomic transaction',
  })
  @IsArray({ message: 'sets must be an array' })
  @ArrayMinSize(1, { message: 'Must provide at least one set log' })
  @ValidateNested({ each: true })
  @Type(() => CreateSetLogDto)
  sets: CreateSetLogDto[];
}
