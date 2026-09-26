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
      await this.ensureSchemaColumns();
    } catch (error) {
      this.logger.warn(
        `Could not connect to PostgreSQL database on startup: ${(error as Error).message}. Connection will be retried on subsequent queries.`,
      );
    }
  }

  private async ensureSchemaColumns() {
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_program_id" TEXT;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "program_start_date" TIMESTAMP(3);
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER'); END IF; END $$;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" "gender";
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3);
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "height_cm" DOUBLE PRECISION;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION;
        ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "program_id" TEXT;
        ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "week_number" INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "total_weeks" INTEGER NOT NULL DEFAULT 12;
        ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "gender" "gender";
        ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3);
        ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "height_cm" DOUBLE PRECISION;
        ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "current_weight_kg" DOUBLE PRECISION;
        ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION;
      `);
      this.logger.log('Verified database schema columns.');
    } catch (err) {
      this.logger.warn(`ensureSchemaColumns: ${(err as Error).message}`);
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
