import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database via Prisma');

      // Ensure apple_id column and index exist
      try {
        await this.$executeRawUnsafe(
          `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apple_id" VARCHAR(255);`,
        );
        await this.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "users_apple_id_key" ON "users"("apple_id");`,
        );
        this.logger.log('Verified users.apple_id column exists');
      } catch (colErr) {
        this.logger.warn(
          `Could not verify apple_id column: ${(colErr as Error).message}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not connect to PostgreSQL database on startup: ${(error as Error).message}. Connection will be retried on subsequent queries.`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error(
        `Error disconnecting from PostgreSQL: ${(error as Error).message}`,
      );
    }
  }
}
