import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
