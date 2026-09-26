-- Migration: add_user_biometrics
-- Adds gender enum, biometric fields to users and onboarding_profiles

-- CreateEnum gender
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER'); END IF; END $$;

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" "gender";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "height_cm" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION;

-- AlterTable onboarding_profiles
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "gender" "gender";
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3);
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "height_cm" DOUBLE PRECISION;
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "current_weight_kg" DOUBLE PRECISION;
ALTER TABLE "onboarding_profiles" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION;
