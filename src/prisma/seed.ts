import {
  PrismaClient,
  UserRole,
  ProgramCategory,
  ProgramLevel,
  ProgramLocation,
  GoalType,
  MealType,
  WorkoutSessionStatus,
  MuscleGroup,
  EquipmentCategory,
  ExperienceLevel,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with valid UUID v4 entries...');

  // 1. Create or update Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gymapp.com' },
    update: {
      passwordHash:
        '$2b$10$BtDuZ9BdSP5A88jlL6Mfr.8S4tc/RBXAabCI2cCnRKmc1pmkrIusa', // bcrypt for "AdminPass123!"
    },
    create: {
      name: 'Admin Gym',
      email: 'admin@gymapp.com',
      passwordHash:
        '$2b$10$BtDuZ9BdSP5A88jlL6Mfr.8S4tc/RBXAabCI2cCnRKmc1pmkrIusa', // bcrypt for "AdminPass123!"
      role: UserRole.ADMIN,
      avatarAssetName: 'avatar_admin',
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'juan.perez@example.com' },
    update: {
      passwordHash:
        '$2b$10$5E3mE5lDNAajGi5/LVApi.nZPs0/pcoSwM//eETyPe2YnXTlHO.ze', // bcrypt for "MemberPass123!"
    },
    create: {
      name: 'Juan Pérez',
      email: 'juan.perez@example.com',
      passwordHash:
        '$2b$10$5E3mE5lDNAajGi5/LVApi.nZPs0/pcoSwM//eETyPe2YnXTlHO.ze', // bcrypt for "MemberPass123!"
      role: UserRole.MEMBER,
      avatarAssetName: 'avatar_user1',
      goalType: GoalType.LOSE_WEIGHT,
    },
  });

  console.log(`✔ Users created: ${adminUser.email}, ${memberUser.email}`);

  // 2. Seed Gym Equipment (10 items across categories)
  const eqBarbellBench = await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888881' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888881',
      name: 'Barra Olímpica y Banco Plano',
      category: EquipmentCategory.FREE_WEIGHTS,
      imageAssetName: 'eq_barbell_bench',
      isAvailableAtGym: true,
    },
  });

  const eqDumbbells = await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888882' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888882',
      name: 'Juego de Mancuernas Ajustables',
      category: EquipmentCategory.FREE_WEIGHTS,
      imageAssetName: 'eq_dumbbells',
      isAvailableAtGym: true,
    },
  });

  const eqCableMachine = await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888883' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888883',
      name: 'Torre de Poleas Dual',
      category: EquipmentCategory.STRENGTH,
      imageAssetName: 'eq_cable_machine',
      isAvailableAtGym: true,
    },
  });

  const eqSquatRack = await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888884' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888884',
      name: 'Power Rack para Sentadillas',
      category: EquipmentCategory.STRENGTH,
      imageAssetName: 'eq_squat_rack',
      isAvailableAtGym: true,
    },
  });

  const eqLegPress = await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888885' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888885',
      name: 'Prensa de Piernas 45 Grados',
      category: EquipmentCategory.STRENGTH,
      imageAssetName: 'eq_leg_press',
      isAvailableAtGym: true,
    },
  });

  await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888886' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888886',
      name: 'Estación de Dominadas y Fondos',
      category: EquipmentCategory.BODYWEIGHT,
      imageAssetName: 'eq_pullup_station',
      isAvailableAtGym: true,
    },
  });

  await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888887' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888887',
      name: 'Caminadora Profesional',
      category: EquipmentCategory.CARDIO,
      imageAssetName: 'eq_treadmill',
      isAvailableAtGym: true,
    },
  });

  await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888888' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Remo de Aire Concept2',
      category: EquipmentCategory.CARDIO,
      imageAssetName: 'eq_rower',
      isAvailableAtGym: true,
    },
  });

  await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-888888888889' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888889',
      name: 'Kettlebells de Competición',
      category: EquipmentCategory.FREE_WEIGHTS,
      imageAssetName: 'eq_kettlebell',
      isAvailableAtGym: true,
    },
  });

  await prisma.equipment.upsert({
    where: { id: '88888888-8888-4888-8888-88888888888a' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-88888888888a',
      name: 'Bandas Elásticas de Resistencia',
      category: EquipmentCategory.ACCESSORY,
      imageAssetName: 'eq_resistance_bands',
      isAvailableAtGym: false, // Example of unavailable equipment for inventory testing
    },
  });

  console.log(`✔ Equipment created: 10 sample pieces of gym equipment`);

  // 3. Create Programs, Workouts & Exercises with MuscleGroup & SubstitutionGroups
  // Program 1: Hipertrofia Total
  const program1 = await prisma.program.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Hipertrofia Total',
      category: ProgramCategory.MUSCLE_GAIN,
      durationWeeks: 8,
      level: ProgramLevel.INTERMEDIATE,
      location: ProgramLocation.GYM,
      tagline: 'Gana masa muscular magra y fuerza progresiva',
      imageAssetName: 'program_hypertrophy',
    },
  });

  const workout1 = await prisma.workout.upsert({
    where: { id: '22222222-2222-4222-8222-222222222221' },
    update: {},
    create: {
      id: '22222222-2222-4222-8222-222222222221',
      programId: program1.id,
      title: 'Pecho & Tríceps Power',
      durationMinutes: 50,
      difficulty: 'Intermedio',
      kcalEstimate: 420,
      imageAssetName: 'workout_chest_triceps',
      rounds: 4,
    },
  });

  // Interchangeable Pair 1: Chest Press Group (sub_group_chest_press)
  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333331' },
    update: {
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqBarbellBench.id,
      substitutionGroupId: 'sub_group_chest_press',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333331',
      workoutId: workout1.id,
      name: 'Press de Banca Plano con Barra',
      order: 1,
      kind: { type: 'reps', count: 10 },
      imageAssetName: 'ex_bench_press',
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqBarbellBench.id,
      substitutionGroupId: 'sub_group_chest_press',
    },
  });

  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333339' },
    update: {
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqDumbbells.id,
      substitutionGroupId: 'sub_group_chest_press',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333339',
      workoutId: workout1.id,
      name: 'Press de Banca Plano con Mancuernas',
      order: 2,
      kind: { type: 'reps', count: 10 },
      imageAssetName: 'ex_dumbbell_bench_press',
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqDumbbells.id,
      substitutionGroupId: 'sub_group_chest_press',
    },
  });

  // Interchangeable Pair 2: Chest Fly Group (sub_group_chest_fly)
  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333332' },
    update: {
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqDumbbells.id,
      substitutionGroupId: 'sub_group_chest_fly',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333332',
      workoutId: workout1.id,
      name: 'Aperturas con Mancuernas en Banco Inclinado',
      order: 3,
      kind: { type: 'reps', count: 12 },
      imageAssetName: 'ex_incline_dumbbell_fly',
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqDumbbells.id,
      substitutionGroupId: 'sub_group_chest_fly',
    },
  });

  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-33333333333a' },
    update: {
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqCableMachine.id,
      substitutionGroupId: 'sub_group_chest_fly',
    },
    create: {
      id: '33333333-3333-4333-8333-33333333333a',
      workoutId: workout1.id,
      name: 'Cruce de Poleas para Pecho',
      order: 4,
      kind: { type: 'reps', count: 12 },
      imageAssetName: 'ex_cable_crossover',
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: eqCableMachine.id,
      substitutionGroupId: 'sub_group_chest_fly',
    },
  });

  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333333' },
    update: {
      primaryMuscleGroup: MuscleGroup.ARMS,
      requiredEquipmentId: eqCableMachine.id,
      substitutionGroupId: 'sub_group_triceps',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333333',
      workoutId: workout1.id,
      name: 'Extensión de Tríceps en Polea Alta',
      order: 5,
      kind: { type: 'reps', count: 15 },
      imageAssetName: 'ex_tricep_pushdown',
      primaryMuscleGroup: MuscleGroup.ARMS,
      requiredEquipmentId: eqCableMachine.id,
      substitutionGroupId: 'sub_group_triceps',
    },
  });

  // Workout 2: Legs & Core
  const workout2 = await prisma.workout.upsert({
    where: { id: '22222222-2222-4222-8222-222222222222' },
    update: {},
    create: {
      id: '22222222-2222-4222-8222-222222222222',
      programId: program1.id,
      title: 'Pierna & Core Explosivo',
      durationMinutes: 55,
      difficulty: 'Avanzado',
      kcalEstimate: 510,
      imageAssetName: 'workout_leg_core',
      rounds: 4,
    },
  });

  // Interchangeable Pair 3: Quad Heavy Group (sub_group_squat_press)
  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333334' },
    update: {
      primaryMuscleGroup: MuscleGroup.LEGS,
      requiredEquipmentId: eqSquatRack.id,
      substitutionGroupId: 'sub_group_squat_press',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333334',
      workoutId: workout2.id,
      name: 'Sentadilla con Barra Trasera',
      order: 1,
      kind: { type: 'reps', count: 8 },
      imageAssetName: 'ex_back_squat',
      primaryMuscleGroup: MuscleGroup.LEGS,
      requiredEquipmentId: eqSquatRack.id,
      substitutionGroupId: 'sub_group_squat_press',
    },
  });

  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-33333333333b' },
    update: {
      primaryMuscleGroup: MuscleGroup.LEGS,
      requiredEquipmentId: eqLegPress.id,
      substitutionGroupId: 'sub_group_squat_press',
    },
    create: {
      id: '33333333-3333-4333-8333-33333333333b',
      workoutId: workout2.id,
      name: 'Prensa de Piernas Inclinada',
      order: 2,
      kind: { type: 'reps', count: 10 },
      imageAssetName: 'ex_leg_press',
      primaryMuscleGroup: MuscleGroup.LEGS,
      requiredEquipmentId: eqLegPress.id,
      substitutionGroupId: 'sub_group_squat_press',
    },
  });

  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333335' },
    update: {
      primaryMuscleGroup: MuscleGroup.CORE,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_core_static',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333335',
      workoutId: workout2.id,
      name: 'Plancha Abdominal Estática',
      order: 3,
      kind: { type: 'duration', seconds: 45 },
      imageAssetName: 'ex_plank',
      primaryMuscleGroup: MuscleGroup.CORE,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_core_static',
    },
  });

  // Program 2: Quema Grasa Express
  const program2 = await prisma.program.upsert({
    where: { id: '11111111-1111-4111-8111-111111111112' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111112',
      title: 'Quema Grasa Express',
      category: ProgramCategory.WEIGHT_LOSS,
      durationWeeks: 4,
      level: ProgramLevel.BEGINNER,
      location: ProgramLocation.HOME,
      tagline: 'Entrenamientos de alta intensidad sin equipamiento',
      imageAssetName: 'program_hiit',
    },
  });

  const workout3 = await prisma.workout.upsert({
    where: { id: '22222222-2222-4222-8222-222222222223' },
    update: {},
    create: {
      id: '22222222-2222-4222-8222-222222222223',
      programId: program2.id,
      title: 'HIIT Full Body',
      durationMinutes: 30,
      difficulty: 'Principiante',
      kcalEstimate: 350,
      imageAssetName: 'workout_hiit_fullbody',
      rounds: 3,
    },
  });

  // Interchangeable Pair 4: Bodyweight Cardio Group (sub_group_cardio_bodyweight)
  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333336' },
    update: {
      primaryMuscleGroup: MuscleGroup.CARDIO,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_cardio_bodyweight',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333336',
      workoutId: workout3.id,
      name: 'Burpees',
      order: 1,
      kind: { type: 'reps', count: 15 },
      imageAssetName: 'ex_burpees',
      primaryMuscleGroup: MuscleGroup.CARDIO,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_cardio_bodyweight',
    },
  });

  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333337' },
    update: {
      primaryMuscleGroup: MuscleGroup.CARDIO,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_cardio_bodyweight',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333337',
      workoutId: workout3.id,
      name: 'Mountain Climbers',
      order: 2,
      kind: { type: 'duration', seconds: 40 },
      imageAssetName: 'ex_mountain_climbers',
      primaryMuscleGroup: MuscleGroup.CARDIO,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_cardio_bodyweight',
    },
  });

  // Program 3: Movilidad & Salud
  const program3 = await prisma.program.upsert({
    where: { id: '11111111-1111-4111-8111-111111111113' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111113',
      title: 'Movilidad & Salud Total',
      category: ProgramCategory.HEALTH,
      durationWeeks: 6,
      level: ProgramLevel.BEGINNER,
      location: ProgramLocation.HOME_AND_GYM,
      tagline: 'Mejora tu postura, flexibilidad y vitalidad diaria',
      imageAssetName: 'program_health',
    },
  });

  const workout4 = await prisma.workout.upsert({
    where: { id: '22222222-2222-4222-8222-222222222224' },
    update: {},
    create: {
      id: '22222222-2222-4222-8222-222222222224',
      programId: program3.id,
      title: 'Movilidad y Flexibilidad',
      durationMinutes: 25,
      difficulty: 'Principiante',
      kcalEstimate: 160,
      imageAssetName: 'workout_mobility',
      rounds: 2,
    },
  });

  await prisma.exercise.upsert({
    where: { id: '33333333-3333-4333-8333-333333333338' },
    update: {
      primaryMuscleGroup: MuscleGroup.BACK,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_mobility',
    },
    create: {
      id: '33333333-3333-4333-8333-333333333338',
      workoutId: workout4.id,
      name: 'Cat-Cow Stretch',
      order: 1,
      kind: { type: 'duration', seconds: 60 },
      imageAssetName: 'ex_cat_cow',
      primaryMuscleGroup: MuscleGroup.BACK,
      requiredEquipmentId: null,
      substitutionGroupId: 'sub_group_mobility',
    },
  });

  console.log(
    `✔ Programs & Workouts created: 3 programs, 4 workouts, 11 exercises with substitution groups`,
  );

  // 4. Create Meals
  await prisma.meal.upsert({
    where: { id: '44444444-4444-4444-8444-444444444441' },
    update: {},
    create: {
      id: '44444444-4444-4444-8444-444444444441',
      name: 'Avena Proteica con Frutos Rojos',
      kcal: 450,
      macros: { protein: 32, carbs: 54, fat: 12 },
      type: MealType.BREAKFAST,
      imageAssetName: 'meal_protein_oats',
    },
  });

  await prisma.meal.upsert({
    where: { id: '44444444-4444-4444-8444-444444444442' },
    update: {},
    create: {
      id: '44444444-4444-4444-8444-444444444442',
      name: 'Bowl de Pollo a la Parrilla y Quinoa',
      kcal: 620,
      macros: { protein: 48, carbs: 55, fat: 22 },
      type: MealType.LUNCH,
      imageAssetName: 'meal_chicken_quinoa_bowl',
    },
  });

  await prisma.meal.upsert({
    where: { id: '44444444-4444-4444-8444-444444444443' },
    update: {},
    create: {
      id: '44444444-4444-4444-8444-444444444443',
      name: 'Salmón al Horno con Espárragos',
      kcal: 580,
      macros: { protein: 42, carbs: 40, fat: 24 },
      type: MealType.DINNER,
      imageAssetName: 'meal_baked_salmon',
    },
  });

  await prisma.meal.upsert({
    where: { id: '44444444-4444-4444-8444-444444444444' },
    update: {},
    create: {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Batido Whey con Plátano y Almendras',
      kcal: 290,
      macros: { protein: 28, carbs: 32, fat: 6 },
      type: MealType.SNACK,
      imageAssetName: 'meal_protein_shake',
    },
  });

  console.log(`✔ Meals created: 4 sample meals across all meal types`);

  // 5. Sample Goal, WeightEntry & WorkoutSession for member
  await prisma.goal.upsert({
    where: { id: '55555555-5555-4555-8555-555555555551' },
    update: {},
    create: {
      id: '55555555-5555-4555-8555-555555555551',
      userId: memberUser.id,
      type: GoalType.LOSE_WEIGHT,
      targetValue: 75.0,
      currentValue: 82.5,
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // +60 days
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
      workoutId: workout1.id,
      date: new Date(),
      status: WorkoutSessionStatus.COMPLETED,
      durationActualSeconds: 2850,
      kcalBurned: 410,
      avgHeartRate: 138,
    },
  });

  // 6. User Equipment Preferences & Onboarding Profile
  await prisma.userEquipmentPreference.upsert({
    where: {
      userId_equipmentId: {
        userId: memberUser.id,
        equipmentId: eqBarbellBench.id,
      },
    },
    update: { isSelected: true },
    create: {
      userId: memberUser.id,
      equipmentId: eqBarbellBench.id,
      isSelected: true,
    },
  });

  await prisma.userEquipmentPreference.upsert({
    where: {
      userId_equipmentId: {
        userId: memberUser.id,
        equipmentId: eqDumbbells.id,
      },
    },
    update: { isSelected: true },
    create: {
      userId: memberUser.id,
      equipmentId: eqDumbbells.id,
      isSelected: true,
    },
  });

  await prisma.userEquipmentPreference.upsert({
    where: {
      userId_equipmentId: {
        userId: memberUser.id,
        equipmentId: eqSquatRack.id,
      },
    },
    update: { isSelected: true },
    create: {
      userId: memberUser.id,
      equipmentId: eqSquatRack.id,
      isSelected: true,
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

  console.log(
    `✔ Sample onboarding profile and equipment preferences seeded for member: ${memberUser.email}`,
  );
  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
