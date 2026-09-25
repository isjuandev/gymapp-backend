-- CreateIndex
CREATE UNIQUE INDEX "meal_entries_user_id_meal_id_date_key" ON "meal_entries"("user_id", "meal_id", "date");
