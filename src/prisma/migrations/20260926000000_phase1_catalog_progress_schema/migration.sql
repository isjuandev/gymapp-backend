-- Phase 1 schema: exercise catalog, progress tracking and custom routines.
-- Materialized from the former runtime hot-patch in prisma.service.ts.
-- All statements are idempotent (IF NOT EXISTS / guarded DO blocks),
-- so applying them to databases already patched at startup is a no-op.

-- Ensure weight_type enum exists (equipment categorization)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weight_type') THEN CREATE TYPE "weight_type" AS ENUM ('FIXED_STACK', 'PLATE_LOADED', 'DUMBBELL_PAIR', 'BARBELL', 'BODYWEIGHT', 'CABLE', 'BAND', 'ACCESSORY'); END IF; END $$;

-- AlterTable: equipment weight metadata
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "weight_type" "weight_type" DEFAULT 'BODYWEIGHT';
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "min_weight_kg" DOUBLE PRECISION;
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "max_weight_kg" DOUBLE PRECISION;
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "increment_kg" DOUBLE PRECISION DEFAULT 2.5;
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "external_name" VARCHAR(255);

-- CreateTable: exercise catalog (synced from AscendAPI)
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_catalog_primary_muscle_group_idx" ON "exercise_catalog"("primary_muscle_group");
CREATE INDEX IF NOT EXISTS "exercise_catalog_equipment_category_idx" ON "exercise_catalog"("equipment_category");
CREATE INDEX IF NOT EXISTS "exercise_catalog_name_idx" ON "exercise_catalog"("name");

-- AlterTable: exercises link to catalog entries with richer metadata
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "catalog_id" TEXT REFERENCES "exercise_catalog"("id") ON DELETE SET NULL;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "video_url" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "instructions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "min_reps" INTEGER DEFAULT 8;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "max_reps" INTEGER DEFAULT 12;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "default_sets" INTEGER DEFAULT 3;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "rest_seconds" INTEGER DEFAULT 90;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercises_catalog_id_idx" ON "exercises"("catalog_id");

-- CreateTable: per-set workout logs
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_set_logs_workout_session_id_idx" ON "exercise_set_logs"("workout_session_id");
CREATE INDEX IF NOT EXISTS "exercise_set_logs_exercise_id_completed_at_idx" ON "exercise_set_logs"("exercise_id", "completed_at");

-- CreateTable: progressive-overload state per user and exercise
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "exercise_progress_states_user_id_idx" ON "exercise_progress_states"("user_id");
CREATE INDEX IF NOT EXISTS "exercise_progress_states_exercise_id_idx" ON "exercise_progress_states"("exercise_id");

-- AlterTable: per-exercise notes on progress state
ALTER TABLE "exercise_progress_states" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- AlterTable: workouts become optionally standalone (custom user workouts)
ALTER TABLE "workouts" ALTER COLUMN "program_id" DROP NOT NULL;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "owner_user_id" TEXT REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "workouts" ALTER COLUMN "duration_minutes" DROP NOT NULL;
ALTER TABLE "workouts" ALTER COLUMN "difficulty" DROP NOT NULL;
ALTER TABLE "workouts" ALTER COLUMN "kcal_estimate" DROP NOT NULL;
ALTER TABLE "workouts" ALTER COLUMN "image_asset_name" DROP NOT NULL;
ALTER TABLE "workouts" ALTER COLUMN "rounds" SET DEFAULT 1;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workouts_owner_user_id_idx" ON "workouts"("owner_user_id");

-- Ensure day_of_week enum exists (custom routine scheduling)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_of_week') THEN CREATE TYPE "day_of_week" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'); END IF; END $$;

-- CreateTable: custom per-weekday routine assignments
CREATE TABLE IF NOT EXISTS "custom_routine_day_assignments" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "day_of_week" "day_of_week" NOT NULL,
  "workout_id" TEXT REFERENCES "workouts"("id") ON DELETE SET NULL,
  "is_rest_day" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "custom_routine_day_assignments_user_id_day_of_week_key" UNIQUE ("user_id", "day_of_week")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "custom_routine_day_assignments_user_id_idx" ON "custom_routine_day_assignments"("user_id");
CREATE INDEX IF NOT EXISTS "custom_routine_day_assignments_workout_id_idx" ON "custom_routine_day_assignments"("workout_id");
