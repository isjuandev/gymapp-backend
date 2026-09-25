import { Module } from '@nestjs/common';
import { AscendApiService } from './ascend-api.service';

@Module({
  providers: [AscendApiService],
  exports: [AscendApiService],
})
export class AscendApiModule {}
