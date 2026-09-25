import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateActivityDailySnapshotDto } from '../dto/create-activity-snapshot.dto';

@Injectable()
export class BatchSnapshotsPipe implements PipeTransform {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transform(value: unknown, _metadata: ArgumentMetadata) {
    let rawItems: unknown[];

    if (Array.isArray(value)) {
      rawItems = value;
    } else if (
      value &&
      typeof value === 'object' &&
      'snapshots' in value &&
      Array.isArray((value as Record<string, unknown>).snapshots)
    ) {
      rawItems = (value as { snapshots: unknown[] }).snapshots;
    } else {
      throw new BadRequestException(
        'Request body must be an array of snapshots or an object with a snapshots array',
      );
    }

    if (rawItems.length === 0) {
      throw new BadRequestException('Snapshots list must not be empty');
    }

    const dtos: CreateActivityDailySnapshotDto[] = [];
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      if (!item || typeof item !== 'object') {
        throw new BadRequestException(
          `Snapshot at index ${i} must be an object`,
        );
      }
      const dto = plainToInstance(CreateActivityDailySnapshotDto, item);
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        const errorMessages = errors
          .flatMap((e) => (e.constraints ? Object.values(e.constraints) : []))
          .join(', ');
        throw new BadRequestException(
          `Validation failed for snapshot at index ${i}: ${errorMessages}`,
        );
      }
      dtos.push(dto);
    }

    return dtos;
  }
}
