-- Migration: add_plan_progression_and_program_enrollment
-- Adds current_program_id and program_start_date to users
-- Adds program_id, week_number and total_weeks to weekly_plans

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_program_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "program_start_date" TIMESTAMP(3);

-- Add ForeignKey on users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_current_program_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_current_program_id_fkey"
      FOREIGN KEY ("current_program_id") REFERENCES "programs"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- AlterTable weekly_plans
ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "program_id" TEXT;
ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "week_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "weekly_plans" ADD COLUMN IF NOT EXISTS "total_weeks" INTEGER NOT NULL DEFAULT 12;

-- Add ForeignKey on weekly_plans (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_plans_program_id_fkey'
  ) THEN
    ALTER TABLE "weekly_plans"
      ADD CONSTRAINT "weekly_plans_program_id_fkey"
      FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "weekly_plans_program_id_idx" ON "weekly_plans"("program_id");
