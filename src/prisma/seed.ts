import {
  PrismaClient,
  UserRole,
  GoalType,
  MealType,
  WorkoutSessionStatus,
  ExperienceLevel,
} from '@prisma/client';
import {
  BASE_EQUIPMENT,
  BASE_CATALOG,
  BASE_PROGRAMS,
} from '../modules/catalog/seed-data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with comprehensive equipment, catalog and 9-program matrix...');

  // 1. Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gymapp.com' },
    update: {
      passwordHash:
        '$2b$10$BtDuZ9BdSP5A88jlL6Mfr.8S4tc/RBXAabCI2cCnRKmc1pmkrIusa',
    },
    create: {
      name: 'Admin Gym',
      email: 'admin@gymapp.com',
      passwordHash:
        '$2b$10$BtDuZ9BdSP5A88jlL6Mfr.8S4tc/RBXAabCI2cCnRKmc1pmkrIusa',
      role: UserRole.ADMIN,
      avatarAssetName: 'avatar_admin',
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'juan.perez@example.com' },
    update: {
      passwordHash:
        '$2b$10$5E3mE5lDNAajGi5/LVApi.nZPs0/pcoSwM//eETyPe2YnXTlHO.ze',
    },
    create: {
      name: 'Juan Pérez',
      email: 'juan.perez@example.com',
      passwordHash:
        '$2b$10$5E3mE5lDNAajGi5/LVApi.nZPs0/pcoSwM//eETyPe2YnXTlHO.ze',
      role: UserRole.MEMBER,
      avatarAssetName: 'avatar_user1',
      goalType: GoalType.LOSE_WEIGHT,
    },
  });

  console.log(`✔ Users verified: ${adminUser.email}, ${memberUser.email}`);

  // 2. Gym Equipment (~28 items with progression parameters)
  for (const eq of BASE_EQUIPMENT) {
    await prisma.equipment.upsert({
      where: { id: eq.id },
      update: {
        name: eq.name,
        category: eq.category,
        weightType: eq.weightType,
        minWeightKg: eq.minWeightKg,
        maxWeightKg: eq.maxWeightKg,
        incrementKg: eq.incrementKg,
        externalName: eq.externalName,
        imageAssetName: eq.imageAssetName,
        isAvailableAtGym: eq.isAvailableAtGym,
      },
      create: eq,
    });
  }
  console.log(`✔ Equipment seeded: ${BASE_EQUIPMENT.length} gym equipment items with weight increments`);

  // 3. ExerciseCatalog
  for (const cat of BASE_CATALOG) {
    await prisma.exerciseCatalog.upsert({
      where: { externalId: cat.externalId },
      update: cat,
      create: cat,
    });
  }
  console.log(`✔ ExerciseCatalog seeded: ${BASE_CATALOG.length} exercises with HD media & tips`);

  // 4. Matrix of 9 Programs (3 Categories x 3 Levels)
  for (const prog of BASE_PROGRAMS) {
    const { workouts, ...programFields } = prog;
    const program = await prisma.program.upsert({
      where: { id: programFields.id },
      update: programFields,
      create: programFields,
    });

    for (const w of workouts) {
      const { exercises, ...workoutFields } = w;
      const workout = await prisma.workout.upsert({
        where: { id: workoutFields.id },
        update: { ...workoutFields, programId: program.id },
        create: { ...workoutFields, programId: program.id },
      });

      for (const ex of exercises) {
        await prisma.exercise.upsert({
          where: { id: ex.id },
          update: {
            workoutId: workout.id,
            catalogId: ex.catalogId,
            name: ex.name,
            order: ex.order,
            kind: ex.kind,
            imageAssetName: ex.imageAssetName,
            primaryMuscleGroup: ex.primaryMuscleGroup,
            requiredEquipmentId: ex.requiredEquipmentId,
            substitutionGroupId: ex.substitutionGroupId,
            minReps: ex.minReps,
            maxReps: ex.maxReps,
            defaultSets: ex.defaultSets,
            restSeconds: ex.restSeconds,
          },
          create: {
            id: ex.id,
            workoutId: workout.id,
            catalogId: ex.catalogId,
            name: ex.name,
            order: ex.order,
            kind: ex.kind,
            imageAssetName: ex.imageAssetName,
            primaryMuscleGroup: ex.primaryMuscleGroup,
            requiredEquipmentId: ex.requiredEquipmentId,
            substitutionGroupId: ex.substitutionGroupId,
            minReps: ex.minReps,
            maxReps: ex.maxReps,
            defaultSets: ex.defaultSets,
            restSeconds: ex.restSeconds,
          },
        });
      }
    }
  }
  console.log(`✔ Programs & Workouts seeded: 9 programs matrix (3 categories x 3 levels)`);

  // 5. Meals
  const meals = [
    {
      id: '44444444-4444-4444-8444-444444444441',
      name: 'Avena Proteica con Frutos Rojos',
      kcal: 450,
      macros: { protein: 32, carbs: 54, fat: 12 },
      type: MealType.BREAKFAST,
      imageAssetName: 'meal_protein_oats',
    },
    {
      id: '44444444-4444-4444-8444-444444444442',
      name: 'Bowl de Pollo a la Parrilla y Quinoa',
      kcal: 620,
      macros: { protein: 48, carbs: 55, fat: 22 },
      type: MealType.LUNCH,
      imageAssetName: 'meal_chicken_quinoa_bowl',
    },
    {
      id: '44444444-4444-4444-8444-444444444443',
      name: 'Salmón al Horno con Espárragos',
      kcal: 580,
      macros: { protein: 42, carbs: 40, fat: 24 },
      type: MealType.DINNER,
      imageAssetName: 'meal_baked_salmon',
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Batido Whey con Plátano y Almendras',
      kcal: 290,
      macros: { protein: 28, carbs: 32, fat: 6 },
      type: MealType.SNACK,
      imageAssetName: 'meal_protein_shake',
    },
  ];

  for (const meal of meals) {
    await prisma.meal.upsert({
      where: { id: meal.id },
      update: meal,
      create: meal,
    });
  }
  console.log(`✔ Meals verified: 4 sample meals across all meal types`);

  // 6. User Progress, Preferences & Goals
  await prisma.goal.upsert({
    where: { id: '55555555-5555-4555-8555-555555555551' },
    update: {},
    create: {
      id: '55555555-5555-4555-8555-555555555551',
      userId: memberUser.id,
      type: GoalType.LOSE_WEIGHT,
      targetValue: 75.0,
      currentValue: 82.5,
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.weightEntry.upsert({
    where: { id: '66666666-6666-4666-8666-666666666661' },
    update: {},
    create: {
      id: '66666666-6666-4666-8666-666666666661',
      userId: memberUser.id,
      date: new Date(),
      weightKg: 82.5,
    },
  });

  await prisma.workoutSession.upsert({
    where: { id: '77777777-7777-4777-8777-777777777771' },
    update: {},
    create: {
      id: '77777777-7777-4777-8777-777777777771',
      userId: memberUser.id,
      workoutId: '22222222-2222-4222-8222-222222222221',
      date: new Date(),
      status: WorkoutSessionStatus.COMPLETED,
      durationActualSeconds: 2850,
      kcalBurned: 410,
      avgHeartRate: 138,
    },
  });

  await prisma.onboardingProfile.upsert({
    where: { userId: memberUser.id },
    update: {},
    create: {
      userId: memberUser.id,
      goal: GoalType.LOSE_WEIGHT,
      experienceLevel: ExperienceLevel.INTERMEDIATE,
      workoutDaysPerWeek: 4,
      completedAt: new Date(),
    },
  });

  // Seed sample initial exercise progress state for progressive overload
  await prisma.exerciseProgressState.upsert({
    where: {
      userId_exerciseId: {
        userId: memberUser.id,
        exerciseId: '33333333-3333-4333-8333-333333333331',
      },
    },
    update: {
      currentWorkingWeightKg: 40.0,
      consecutiveSessionsAtTarget: 2,
      suggestedNextWeightKg: 42.5,
    },
    create: {
      userId: memberUser.id,
      exerciseId: '33333333-3333-4333-8333-333333333331',
      currentWorkingWeightKg: 40.0,
      consecutiveSessionsAtTarget: 2,
      suggestedNextWeightKg: 42.5,
      lastSessionDate: new Date(),
    },
  });

  console.log('✅ Seeding completed successfully with equipment, catalog, 9-program matrix and progress state!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
