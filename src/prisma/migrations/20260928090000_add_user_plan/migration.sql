-- Migration: add_user_plan (Fase 2 plan consistency)
-- Canonical active plan per user (user_plans, one row per user) plus origin
-- tracking on the single weekly schedule (custom_routine_day_assignments).
-- Fully idempotent: safe to re-run via `prisma migrate deploy`.

-- CreateEnum plan_type
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN CREATE TYPE "plan_type" AS ENUM ('PRESET', 'CUSTOM'); END IF; END $$;

-- CreateEnum schedule_origin
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_origin') THEN CREATE TYPE "schedule_origin" AS ENUM ('PRESET_GENERATED', 'MANUAL'); END IF; END $$;

-- CreateTable user_plans
CREATE TABLE IF NOT EXISTS "user_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_type" "plan_type" NOT NULL,
    "program_id" TEXT,
    "goal" "goal_type" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex user_plans_user_id_key
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_plans_user_id_key') THEN ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_key" UNIQUE ("user_id"); END IF; END $$;

-- CreateIndex user_plans_program_id_idx
CREATE INDEX IF NOT EXISTS "user_plans_program_id_idx" ON "user_plans"("program_id");

-- AddForeignKey user_plans -> users (Cascade: plan dies with user)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_plans_user_id_fkey') THEN ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey user_plans -> programs (SetNull: deleting a program must not delete the plan)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_plans_program_id_fkey') THEN ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

-- AlterTable custom_routine_day_assignments: origin tracking (single-writer audit)
ALTER TABLE "custom_routine_day_assignments" ADD COLUMN IF NOT EXISTS "origin" "schedule_origin" NOT NULL DEFAULT 'MANUAL';
