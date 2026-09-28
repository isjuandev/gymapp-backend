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
    const statements = [
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_program_id" TEXT',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "program_start_date" TIMESTAMP(3)',
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER'); END IF; END $$`,
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" "gender"',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3)',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "height_cm" DOUBLE PRECISION',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION',
      'ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "program_id" TEXT',
      'ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "week_number" INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "total_weeks" INTEGER NOT NULL DEFAULT 12',
      'ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "gender" "gender"',
      'ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3)',
      'ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "height_cm" DOUBLE PRECISION',
      'ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "current_weight_kg" DOUBLE PRECISION',
      'ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION',
      // Fase 2 plan consistency (canonical active plan + single schedule origin).
      // Primary path is migration 20260928090000_add_user_plan; these guards
      // only cover databases whose migration history drifted.
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN CREATE TYPE "plan_type" AS ENUM ('PRESET', 'CUSTOM'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_origin') THEN CREATE TYPE "schedule_origin" AS ENUM ('PRESET_GENERATED', 'MANUAL'); END IF; END $$`,
      `CREATE TABLE IF NOT EXISTS "user_plans" ("id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "plan_type" "plan_type" NOT NULL, "program_id" TEXT, "goal" "goal_type" NOT NULL, "started_at" TIMESTAMP(3) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id"))`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_plans_user_id_key') THEN ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_key" UNIQUE ("user_id"); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_plans_user_id_fkey') THEN ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_plans_program_id_fkey') THEN ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$`,
      'ALTER TABLE "custom_routine_day_assignments" ADD COLUMN IF NOT EXISTS "origin" "schedule_origin" NOT NULL DEFAULT \'MANUAL\'',
    ];

    for (const sql of statements) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (err) {
        this.logger.warn(
          `ensureSchemaColumns statement [${sql.slice(0, 30)}...]: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log('Verified database schema columns.');
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
