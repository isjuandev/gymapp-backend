-- CreateEnum
CREATE TYPE "muscle_group" AS ENUM ('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'CORE', 'CARDIO', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "equipment_category" AS ENUM ('CARDIO', 'STRENGTH', 'FREE_WEIGHTS', 'BODYWEIGHT', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "experience_level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "primary_muscle_group" "muscle_group" NOT NULL DEFAULT 'FULL_BODY',
ADD COLUMN     "required_equipment_id" TEXT,
ADD COLUMN     "substitution_group_id" TEXT;

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "equipment_category" NOT NULL,
    "image_asset_name" TEXT NOT NULL,
    "is_available_at_gym" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_equipment_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_equipment_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goal" "goal_type" NOT NULL,
    "experience_level" "experience_level" NOT NULL,
    "workout_days_per_week" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "onboarding_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_equipment_preferences_user_id_idx" ON "user_equipment_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_equipment_preferences_equipment_id_idx" ON "user_equipment_preferences"("equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_equipment_preferences_user_id_equipment_id_key" ON "user_equipment_preferences"("user_id", "equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_profiles_user_id_key" ON "onboarding_profiles"("user_id");

-- CreateIndex
CREATE INDEX "exercises_substitution_group_id_idx" ON "exercises"("substitution_group_id");

-- CreateIndex
CREATE INDEX "exercises_required_equipment_id_idx" ON "exercises"("required_equipment_id");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_required_equipment_id_fkey" FOREIGN KEY ("required_equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_equipment_preferences" ADD CONSTRAINT "user_equipment_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_equipment_preferences" ADD CONSTRAINT "user_equipment_preferences_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
