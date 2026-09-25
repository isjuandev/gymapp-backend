import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GoalType,
  ExperienceLevel,
  ProgramCategory,
  ProgramLevel,
  MuscleGroup,
  PlanDayStatus,
} from '@prisma/client';
import { getMondayOfWeek } from '../plan/utils/date.utils';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: any;

  const userId = 'user-uuid-1111';
  const monday = getMondayOfWeek(new Date());

  const mockProfile = {
    id: 'profile-uuid-1',
    userId,
    goal: GoalType.LOSE_WEIGHT,
    experienceLevel: ExperienceLevel.INTERMEDIATE,
    workoutDaysPerWeek: 3,
    completedAt: new Date('2026-09-24T10:00:00Z'),
  };

  const mockWorkout1 = {
    id: 'workout-uuid-1',
    programId: 'program-uuid-1',
    title: 'Workout Day A',
    durationMinutes: 45,
    difficulty: 'Intermedio',
    kcalEstimate: 400,
    imageAssetName: 'w1',
    rounds: 3,
  };

  const mockWorkout2 = {
    id: 'workout-uuid-2',
    programId: 'program-uuid-1',
    title: 'Workout Day B',
    durationMinutes: 45,
    difficulty: 'Intermedio',
    kcalEstimate: 420,
    imageAssetName: 'w2',
    rounds: 3,
  };

  const mockWorkout3 = {
    id: 'workout-uuid-3',
    programId: 'program-uuid-1',
    title: 'Workout Day C',
    durationMinutes: 50,
    difficulty: 'Intermedio',
    kcalEstimate: 450,
    imageAssetName: 'w3',
    rounds: 4,
  };

  const mockProgram = {
    id: 'program-uuid-1',
    title: 'Weight Loss Intermedio',
    category: ProgramCategory.WEIGHT_LOSS,
    level: ProgramLevel.INTERMEDIATE,
    durationWeeks: 8,
    location: 'GYM',
    tagline: 'Tagline',
    imageAssetName: 'img',
    workouts: [mockWorkout1, mockWorkout2, mockWorkout3],
  };

  beforeEach(async () => {
    prisma = {
      onboardingProfile: {
        findUnique: jest.fn(),
      },
      program: {
        findMany: jest.fn(),
      },
      weeklyPlan: {
        findFirst: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      planDay: {
        deleteMany: jest.fn(),
      },
      exercise: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      userEquipmentPreference: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
  });

  describe('generateWeeklyPlan', () => {
    it('should throw BadRequestException if user onboarding profile is missing or incomplete', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue(null);

      await expect(service.generateWeeklyPlan(userId, monday)).rejects.toThrow(
        BadRequestException,
      );

      prisma.onboardingProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        completedAt: null,
      });

      await expect(service.generateWeeklyPlan(userId, monday)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should generate plan for 3 days/week with Mon, Wed, Fri workouts and rest days for the remaining 4 days', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.program.findMany.mockResolvedValue([mockProgram]);
      prisma.weeklyPlan.findFirst.mockResolvedValue(null);

      let createdPlanData: any;
      prisma.weeklyPlan.create.mockImplementation((args: any) => {
        createdPlanData = args.data;
        return {
          id: 'plan-new-id',
          userId,
          weekStartDate: monday,
          days: args.data.days.create.map((d: any, index: number) => ({
            id: `day-${index}`,
            ...d,
            workout: d.workoutId
              ? [mockWorkout1, mockWorkout2, mockWorkout3].find(
                  (w) => w.id === d.workoutId,
                )
              : null,
          })),
        };
      });

      const result = await service.generateWeeklyPlan(userId, monday);

      expect(prisma.onboardingProfile.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.program.findMany).toHaveBeenCalledWith({
        where: {
          category: ProgramCategory.WEIGHT_LOSS,
          level: ProgramLevel.INTERMEDIATE,
        },
        include: {
          workouts: {
            orderBy: { title: 'asc' },
          },
        },
        orderBy: { title: 'asc' },
      });

      expect(result.days).toHaveLength(7);

      // Verify Mon (0), Wed (2), Fri (4) are workout days
      const days = createdPlanData.days.create;
      expect(days[0].isRestDay).toBe(false); // Mon
      expect(days[0].workoutId).toBe(mockWorkout1.id);
      expect(days[1].isRestDay).toBe(true); // Tue
      expect(days[1].workoutId).toBeNull();
      expect(days[2].isRestDay).toBe(false); // Wed
      expect(days[2].workoutId).toBe(mockWorkout2.id);
      expect(days[3].isRestDay).toBe(true); // Thu
      expect(days[3].workoutId).toBeNull();
      expect(days[4].isRestDay).toBe(false); // Fri
      expect(days[4].workoutId).toBe(mockWorkout3.id);
      expect(days[5].isRestDay).toBe(true); // Sat
      expect(days[5].workoutId).toBeNull();
      expect(days[6].isRestDay).toBe(true); // Sun
      expect(days[6].workoutId).toBeNull();

      // All days must be UPCOMING
      days.forEach((day: any) => {
        expect(day.status).toBe(PlanDayStatus.UPCOMING);
      });
    });

    it('should fallback to closest level when exact level program is not available', async () => {
      // User is ADVANCED
      prisma.onboardingProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        experienceLevel: ExperienceLevel.ADVANCED,
      });

      // No ADVANCED program; INTERMEDIATE program exists
      prisma.program.findMany
        .mockResolvedValueOnce([]) // First call for ADVANCED -> empty
        .mockResolvedValueOnce([mockProgram]); // Second call for INTERMEDIATE -> found!

      prisma.weeklyPlan.findFirst.mockResolvedValue(null);
      prisma.weeklyPlan.create.mockImplementation((args: any) => ({
        id: 'plan-new-id',
        userId,
        weekStartDate: monday,
        days: args.data.days.create,
      }));

      const result = await service.generateWeeklyPlan(userId, monday);

      expect(prisma.program.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.program.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          category: ProgramCategory.WEIGHT_LOSS,
          level: ProgramLevel.ADVANCED,
        },
        include: {
          workouts: { orderBy: { title: 'asc' } },
        },
        orderBy: { title: 'asc' },
      });
      expect(prisma.program.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          category: ProgramCategory.WEIGHT_LOSS,
          level: ProgramLevel.INTERMEDIATE,
        },
        include: {
          workouts: { orderBy: { title: 'asc' } },
        },
        orderBy: { title: 'asc' },
      });

      expect(result).toBeDefined();
    });

    it('should repeat workout pattern when fewer workouts than workoutDaysPerWeek', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue({
        ...mockProfile,
        workoutDaysPerWeek: 5,
      });

      // Only 2 workouts available in program
      const programWithTwoWorkouts = {
        ...mockProgram,
        workouts: [mockWorkout1, mockWorkout2],
      };
      prisma.program.findMany.mockResolvedValue([programWithTwoWorkouts]);
      prisma.weeklyPlan.findFirst.mockResolvedValue(null);

      let createdDays: any;
      prisma.weeklyPlan.create.mockImplementation((args: any) => {
        createdDays = args.data.days.create;
        return {
          id: 'plan-new-id',
          userId,
          weekStartDate: monday,
          days: createdDays,
        };
      });

      await service.generateWeeklyPlan(userId, monday);

      // Active days for 5 days: Mon(0), Tue(1), Wed(2), Fri(4), Sat(5)
      expect(createdDays[0].workoutId).toBe(mockWorkout1.id);
      expect(createdDays[1].workoutId).toBe(mockWorkout2.id);
      expect(createdDays[2].workoutId).toBe(mockWorkout1.id); // repeated
      expect(createdDays[3].isRestDay).toBe(true);
      expect(createdDays[4].workoutId).toBe(mockWorkout2.id); // repeated
      expect(createdDays[5].workoutId).toBe(mockWorkout1.id); // repeated
      expect(createdDays[6].isRestDay).toBe(true);
    });

    it('should replace existing plan when one is already present for target week', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue(mockProfile);
      prisma.program.findMany.mockResolvedValue([mockProgram]);

      const existingPlan = { id: 'old-plan-id', userId, weekStartDate: monday };
      prisma.weeklyPlan.findFirst.mockResolvedValue(existingPlan);
      prisma.planDay.deleteMany.mockResolvedValue({ count: 7 });
      prisma.weeklyPlan.delete.mockResolvedValue(existingPlan);
      prisma.weeklyPlan.create.mockResolvedValue({
        id: 'new-plan-id',
        userId,
        weekStartDate: monday,
        days: [],
      });

      await service.generateWeeklyPlan(userId, monday);

      expect(prisma.planDay.deleteMany).toHaveBeenCalledWith({
        where: { weeklyPlanId: existingPlan.id },
      });
      expect(prisma.weeklyPlan.delete).toHaveBeenCalledWith({
        where: { id: existingPlan.id },
      });
    });
  });

  describe('resolveExerciseForUser', () => {
    const exerciseBarbell = {
      id: 'ex-barbell-1',
      workoutId: 'workout-1',
      name: 'Press de Banca Plano con Barra',
      order: 1,
      kind: { type: 'reps', count: 10 },
      imageAssetName: 'img_barbell',
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: 'eq-barbell',
      substitutionGroupId: 'sub_chest_press',
    };

    const exerciseDumbbell = {
      id: 'ex-dumbbell-1',
      workoutId: 'workout-2',
      name: 'Press de Banca Plano con Mancuernas',
      order: 2,
      kind: { type: 'reps', count: 12 },
      imageAssetName: 'img_dumbbell',
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: 'eq-dumbbell',
      substitutionGroupId: 'sub_chest_press',
    };

    const exercisePushup = {
      id: 'ex-pushup-1',
      workoutId: 'workout-3',
      name: 'Flexiones de Pecho',
      order: 3,
      kind: { type: 'reps', count: 15 },
      imageAssetName: 'img_pushup',
      primaryMuscleGroup: MuscleGroup.CHEST,
      requiredEquipmentId: null, // bodyweight
      substitutionGroupId: 'sub_chest_press',
    };

    it('should return exercise as-is if no equipment is required (bodyweight)', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercisePushup);

      const result = await service.resolveExerciseForUser(
        exercisePushup.id,
        userId,
      );

      expect(result.id).toBe(exercisePushup.id);
      expect(result.wasSubstituted).toBe(false);
      expect(result.originalExerciseId).toBeNull();
      expect(result.noEquipmentAvailable).toBe(false);
    });

    it('should return exercise as-is if user HAS the required equipment selected', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exerciseBarbell);
      prisma.userEquipmentPreference.findUnique.mockResolvedValue({
        userId,
        equipmentId: 'eq-barbell',
        isSelected: true,
      });

      const result = await service.resolveExerciseForUser(
        exerciseBarbell.id,
        userId,
      );

      expect(result.id).toBe(exerciseBarbell.id);
      expect(result.wasSubstituted).toBe(false);
      expect(result.originalExerciseId).toBeNull();
      expect(result.noEquipmentAvailable).toBe(false);
    });

    it('should substitute exercise when user lacks equipment and a dumbbell substitute is available', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exerciseBarbell);
      // User does NOT have barbell
      prisma.userEquipmentPreference.findUnique.mockResolvedValue({
        userId,
        equipmentId: 'eq-barbell',
        isSelected: false,
      });

      // Substitutes in group
      prisma.exercise.findMany.mockResolvedValue([
        exerciseDumbbell,
        exercisePushup,
      ]);

      // User has dumbbells selected
      prisma.userEquipmentPreference.findMany.mockResolvedValue([
        { equipmentId: 'eq-dumbbell' },
      ]);

      const result = await service.resolveExerciseForUser(
        exerciseBarbell.id,
        userId,
      );

      expect(result.id).toBe(exerciseDumbbell.id);
      expect(result.name).toBe(exerciseDumbbell.name);
      expect(result.order).toBe(exerciseBarbell.order); // Order preserved!
      expect(result.wasSubstituted).toBe(true);
      expect(result.originalExerciseId).toBe(exerciseBarbell.id);
      expect(result.noEquipmentAvailable).toBe(false);
    });

    it('should substitute exercise with bodyweight variant when user lacks any equipment', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exerciseBarbell);
      // User does NOT have barbell
      prisma.userEquipmentPreference.findUnique.mockResolvedValue(null);

      // Substitutes in group: dumbbell & pushup
      prisma.exercise.findMany.mockResolvedValue([
        exerciseDumbbell,
        exercisePushup,
      ]);

      // User has NO equipment preferences
      prisma.userEquipmentPreference.findMany.mockResolvedValue([]);

      const result = await service.resolveExerciseForUser(
        exerciseBarbell.id,
        userId,
      );

      expect(result.id).toBe(exercisePushup.id);
      expect(result.name).toBe(exercisePushup.name);
      expect(result.order).toBe(exerciseBarbell.order);
      expect(result.wasSubstituted).toBe(true);
      expect(result.originalExerciseId).toBe(exerciseBarbell.id);
      expect(result.noEquipmentAvailable).toBe(false);
    });

    it('should return original exercise with noEquipmentAvailable=true when no substitute is possible', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exerciseBarbell);
      prisma.userEquipmentPreference.findUnique.mockResolvedValue(null);

      // No substitutes exist for this group
      prisma.exercise.findMany.mockResolvedValue([]);

      const result = await service.resolveExerciseForUser(
        exerciseBarbell.id,
        userId,
      );

      expect(result.id).toBe(exerciseBarbell.id);
      expect(result.wasSubstituted).toBe(false);
      expect(result.originalExerciseId).toBeNull();
      expect(result.noEquipmentAvailable).toBe(true);
    });

    it('should throw NotFoundException if exercise does not exist', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveExerciseForUser('non-existent-id', userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
