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

      // Ensure Phase 1 tables and columns exist
      try {
        await this.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weight_type') THEN
              CREATE TYPE "weight_type" AS ENUM ('FIXED_STACK', 'PLATE_LOADED', 'DUMBBELL_PAIR', 'BARBELL', 'BODYWEIGHT', 'CABLE', 'BAND', 'ACCESSORY');
            END IF;
          END $$;
        `);

        // equipment additions
        await this.$executeRawUnsafe(`
          ALTER TABLE "equipment"
            ADD COLUMN IF NOT EXISTS "weight_type" "weight_type" DEFAULT 'BODYWEIGHT',
            ADD COLUMN IF NOT EXISTS "min_weight_kg" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "max_weight_kg" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "increment_kg" DOUBLE PRECISION DEFAULT 2.5,
            ADD COLUMN IF NOT EXISTS "external_name" VARCHAR(255);
        `);

        // exercise_catalog table
        await this.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "exercise_catalog" (
            "id" TEXT PRIMARY KEY,
            "external_id" VARCHAR(255) UNIQUE,
            "name" VARCHAR(255) NOT NULL,
            "name_es" VARCHAR(255),
            "video_url" TEXT,
            "image_url" TEXT,
            "instructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "exercise_tips" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "primary_muscle_group" "muscle_group" NOT NULL DEFAULT 'FULL_BODY',
            "target_muscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "secondary_muscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
            "equipment_category" "equipment_category" NOT NULL DEFAULT 'STRENGTH',
            "equipment_name" VARCHAR(255),
            "suggested_min_reps" INTEGER NOT NULL DEFAULT 8,
            "suggested_max_reps" INTEGER NOT NULL DEFAULT 12,
            "default_rest_seconds" INTEGER NOT NULL DEFAULT 90,
            "equipment_id" TEXT REFERENCES "equipment"("id") ON DELETE SET NULL,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS "exercise_catalog_primary_muscle_group_idx" ON "exercise_catalog"("primary_muscle_group");
          CREATE INDEX IF NOT EXISTS "exercise_catalog_equipment_category_idx" ON "exercise_catalog"("equipment_category");
          CREATE INDEX IF NOT EXISTS "exercise_catalog_name_idx" ON "exercise_catalog"("name");
        `);

        // exercises additions
        await this.$executeRawUnsafe(`
          ALTER TABLE "exercises"
            ADD COLUMN IF NOT EXISTS "catalog_id" TEXT REFERENCES "exercise_catalog"("id") ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS "video_url" TEXT,
            ADD COLUMN IF NOT EXISTS "image_url" TEXT,
            ADD COLUMN IF NOT EXISTS "instructions" TEXT[] DEFAULT ARRAY[]::TEXT[],
            ADD COLUMN IF NOT EXISTS "min_reps" INTEGER DEFAULT 8,
            ADD COLUMN IF NOT EXISTS "max_reps" INTEGER DEFAULT 12,
            ADD COLUMN IF NOT EXISTS "default_sets" INTEGER DEFAULT 3,
            ADD COLUMN IF NOT EXISTS "rest_seconds" INTEGER DEFAULT 90;
          CREATE INDEX IF NOT EXISTS "exercises_catalog_id_idx" ON "exercises"("catalog_id");
        `);

        // exercise_set_logs table
        await this.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "exercise_set_logs" (
            "id" TEXT PRIMARY KEY,
            "workout_session_id" TEXT NOT NULL REFERENCES "workout_sessions"("id") ON DELETE CASCADE,
            "exercise_id" TEXT NOT NULL REFERENCES "exercises"("id") ON DELETE CASCADE,
            "set_number" INTEGER NOT NULL,
            "weight_kg" DOUBLE PRECISION NOT NULL,
            "reps" INTEGER NOT NULL,
            "is_warmup" BOOLEAN NOT NULL DEFAULT false,
            "rpe" DOUBLE PRECISION,
            "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS "exercise_set_logs_workout_session_id_idx" ON "exercise_set_logs"("workout_session_id");
          CREATE INDEX IF NOT EXISTS "exercise_set_logs_exercise_id_completed_at_idx" ON "exercise_set_logs"("exercise_id", "completed_at");
        `);

        // exercise_progress_states table
        await this.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "exercise_progress_states" (
            "id" TEXT PRIMARY KEY,
            "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "exercise_id" TEXT NOT NULL REFERENCES "exercises"("id") ON DELETE CASCADE,
            "current_working_weight_kg" DOUBLE PRECISION NOT NULL,
            "consecutive_sessions_at_target" INTEGER NOT NULL DEFAULT 0,
            "suggested_next_weight_kg" DOUBLE PRECISION,
            "last_session_date" TIMESTAMP(3),
            "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "exercise_progress_states_user_id_exercise_id_key" UNIQUE ("user_id", "exercise_id")
          );
          CREATE INDEX IF NOT EXISTS "exercise_progress_states_user_id_idx" ON "exercise_progress_states"("user_id");
          CREATE INDEX IF NOT EXISTS "exercise_progress_states_exercise_id_idx" ON "exercise_progress_states"("exercise_id");
        `);

        this.logger.log('Verified and applied Phase 1 schema migrations successfully');
      } catch (phase1Err) {
        this.logger.warn(
          `Could not verify/apply Phase 1 migrations: ${(phase1Err as Error).message}`,
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
