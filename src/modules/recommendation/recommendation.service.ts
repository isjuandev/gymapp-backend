import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GoalType,
  ProgramCategory,
  ProgramLevel,
  ExperienceLevel,
  MuscleGroup,
  PlanDayStatus,
  WeeklyPlan,
  PlanDay,
  Workout,
  Program,
} from '@prisma/client';
import { addDaysUTC } from '../plan/utils/date.utils';

export interface ResolvedExercise {
  id: string;
  name: string;
  order: number;
  kind: any;
  imageAssetName: string;
  primaryMuscleGroup: MuscleGroup;
  requiredEquipmentId: string | null;
  substitutionGroupId: string | null;
  wasSubstituted: boolean;
  originalExerciseId?: string | null;
  noEquipmentAvailable: boolean;
}

export const GOAL_TO_CATEGORY: Record<GoalType, ProgramCategory> = {
  [GoalType.LOSE_WEIGHT]: ProgramCategory.WEIGHT_LOSS,
  [GoalType.GAIN_MUSCLE]: ProgramCategory.MUSCLE_GAIN,
  [GoalType.IMPROVE_HEALTH]: ProgramCategory.HEALTH,
};

export const LEVEL_FALLBACK_ORDER: Record<ExperienceLevel, ProgramLevel[]> = {
  [ExperienceLevel.BEGINNER]: [
    ProgramLevel.BEGINNER,
    ProgramLevel.INTERMEDIATE,
    ProgramLevel.ADVANCED,
  ],
  [ExperienceLevel.INTERMEDIATE]: [
    ProgramLevel.INTERMEDIATE,
    ProgramLevel.BEGINNER,
    ProgramLevel.ADVANCED,
  ],
  [ExperienceLevel.ADVANCED]: [
    ProgramLevel.ADVANCED,
    ProgramLevel.INTERMEDIATE,
    ProgramLevel.BEGINNER,
  ],
};

export const WORKOUT_DAY_DISTRIBUTION: Record<number, number[]> = {
  1: [0], // Mon
  2: [1, 3], // Tue, Thu
  3: [0, 2, 4], // Mon, Wed, Fri
  4: [0, 1, 3, 4], // Mon, Tue, Thu, Fri
  5: [0, 1, 2, 4, 5], // Mon, Tue, Wed, Fri, Sat
  6: [0, 1, 2, 3, 4, 5], // Mon-Sat
  7: [0, 1, 2, 3, 4, 5, 6], // Every day
};

export type WeeklyPlanWithDaysAndWorkouts = WeeklyPlan & {
  days: (PlanDay & { workout?: Workout | null })[];
};

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a tailored 7-day WeeklyPlan with PlanDays for a user based on their
   * OnboardingProfile and equipment preferences.
   */
  async generateWeeklyPlan(
    userId: string,
    weekStartDate: Date,
  ): Promise<WeeklyPlanWithDaysAndWorkouts> {
    // 1. Fetch user OnboardingProfile
    const profile = await this.prisma.onboardingProfile.findUnique({
      where: { userId },
    });

    if (!profile || !profile.completedAt) {
      throw new BadRequestException(
        'User onboarding profile not found or incomplete. Cannot generate plan.',
      );
    }

    // 2. Map goal to ProgramCategory
    const category = GOAL_TO_CATEGORY[profile.goal];

    // 3. Find matching Programs by category and level (with fallback hierarchy)
    const fallbackLevels = LEVEL_FALLBACK_ORDER[profile.experienceLevel];
    let matchedPrograms: (Program & { workouts: Workout[] })[] = [];

    for (const level of fallbackLevels) {
      const programs = await this.prisma.program.findMany({
        where: {
          category,
          level,
        },
        include: {
          workouts: {
            orderBy: { title: 'asc' },
          },
        },
        orderBy: { title: 'asc' },
      });

      if (programs.length > 0 && programs.some((p) => p.workouts.length > 0)) {
        matchedPrograms = programs;
        if (level !== fallbackLevels[0]) {
          this.logger.warn(
            `No programs found for category '${category}' with exact level '${fallbackLevels[0]}'. Applied fallback to level '${level}'.`,
          );
        }
        break;
      }
    }

    // Fallback to any program in category if still empty
    if (matchedPrograms.length === 0) {
      const categoryPrograms = await this.prisma.program.findMany({
        where: { category },
        include: {
          workouts: {
            orderBy: { title: 'asc' },
          },
        },
        orderBy: { title: 'asc' },
      });

      if (
        categoryPrograms.length > 0 &&
        categoryPrograms.some((p) => p.workouts.length > 0)
      ) {
        matchedPrograms = categoryPrograms;
        this.logger.warn(
          `No programs found for category '${category}' at any requested level. Falling back to any available program in category.`,
        );
      } else {
        // Fallback to any available program in database
        const anyPrograms = await this.prisma.program.findMany({
          include: {
            workouts: {
              orderBy: { title: 'asc' },
            },
          },
          orderBy: { title: 'asc' },
        });

        if (
          anyPrograms.length > 0 &&
          anyPrograms.some((p) => p.workouts.length > 0)
        ) {
          matchedPrograms = anyPrograms;
          this.logger.warn(
            `No programs found for category '${category}'. Falling back to any available program in database.`,
          );
        } else {
          throw new NotFoundException(
            `No available programs or workouts found to generate weekly plan for user '${userId}'.`,
          );
        }
      }
    }

    // 4. Gather available workouts
    const availableWorkouts = matchedPrograms.flatMap((p) => p.workouts);
    if (availableWorkouts.length === 0) {
      throw new NotFoundException(
        `No workouts found in matched programs to generate weekly plan for user '${userId}'.`,
      );
    }

    // 5. Select workouts for target days
    const targetDays = Math.min(Math.max(profile.workoutDaysPerWeek, 1), 7);
    const selectedWorkouts: Workout[] = [];
    for (let i = 0; i < targetDays; i++) {
      selectedWorkouts.push(availableWorkouts[i % availableWorkouts.length]);
    }

    // 6. Distribute workouts across 7 days (Mon to Sun)
    const activeIndices = new Set(
      WORKOUT_DAY_DISTRIBUTION[targetDays] || [0, 2, 4],
    );
    let workoutIdx = 0;
    const planDaysData: {
      date: Date;
      workoutId: string | null;
      isRestDay: boolean;
      status: PlanDayStatus;
    }[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = addDaysUTC(weekStartDate, dayIndex);
      if (activeIndices.has(dayIndex)) {
        const workout = selectedWorkouts[workoutIdx++];
        planDaysData.push({
          date,
          workoutId: workout.id,
          isRestDay: false,
          status: PlanDayStatus.UPCOMING,
        });
      } else {
        planDaysData.push({
          date,
          workoutId: null,
          isRestDay: true,
          status: PlanDayStatus.UPCOMING,
        });
      }
    }

    // 7. Transactionally persist WeeklyPlan and PlanDays
    return this.prisma.$transaction(async (tx) => {
      const existingPlan = await tx.weeklyPlan.findFirst({
        where: {
          userId,
          weekStartDate,
        },
      });

      if (existingPlan) {
        await tx.planDay.deleteMany({
          where: { weeklyPlanId: existingPlan.id },
        });
        await tx.weeklyPlan.delete({
          where: { id: existingPlan.id },
        });
      }

      return tx.weeklyPlan.create({
        data: {
          userId,
          weekStartDate,
          days: {
            create: planDaysData,
          },
        },
        include: {
          days: {
            include: {
              workout: true,
            },
            orderBy: {
              date: 'asc',
            },
          },
        },
      });
    });
  }

  /**
   * Resolves which exercise variant to present to a user based on their equipment preferences.
   * If the user lacks the equipment, it finds a substitute within the same substitution group.
   * Does NOT mutate the database.
   */
  async resolveExerciseForUser(
    exerciseId: string,
    userId: string,
  ): Promise<ResolvedExercise> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID '${exerciseId}' not found`);
    }

    // a) Bodyweight exercise: no equipment required
    if (!exercise.requiredEquipmentId) {
      return {
        id: exercise.id,
        name: exercise.name,
        order: exercise.order,
        kind: exercise.kind,
        imageAssetName: exercise.imageAssetName,
        primaryMuscleGroup: exercise.primaryMuscleGroup,
        requiredEquipmentId: null,
        substitutionGroupId: exercise.substitutionGroupId,
        wasSubstituted: false,
        originalExerciseId: null,
        noEquipmentAvailable: false,
      };
    }

    // b) Check user equipment preference for required equipment
    const userPref = await this.prisma.userEquipmentPreference.findUnique({
      where: {
        userId_equipmentId: {
          userId,
          equipmentId: exercise.requiredEquipmentId,
        },
      },
    });

    if (userPref && userPref.isSelected) {
      return {
        id: exercise.id,
        name: exercise.name,
        order: exercise.order,
        kind: exercise.kind,
        imageAssetName: exercise.imageAssetName,
        primaryMuscleGroup: exercise.primaryMuscleGroup,
        requiredEquipmentId: exercise.requiredEquipmentId,
        substitutionGroupId: exercise.substitutionGroupId,
        wasSubstituted: false,
        originalExerciseId: null,
        noEquipmentAvailable: false,
      };
    }

    // c) Equipment not selected: search substitutes in the same substitution group
    if (exercise.substitutionGroupId) {
      const candidateSubstitutes = await this.prisma.exercise.findMany({
        where: {
          substitutionGroupId: exercise.substitutionGroupId,
          id: { not: exercise.id },
        },
        orderBy: { order: 'asc' },
      });

      if (candidateSubstitutes.length > 0) {
        const userSelectedPrefs =
          await this.prisma.userEquipmentPreference.findMany({
            where: {
              userId,
              isSelected: true,
            },
            select: { equipmentId: true },
          });

        const selectedEquipmentIds = new Set(
          userSelectedPrefs.map((p) => p.equipmentId),
        );

        // Find candidate where user has equipment selected, or fallback to bodyweight (requiredEquipmentId === null)
        const validSubstitute =
          candidateSubstitutes.find(
            (sub) =>
              sub.requiredEquipmentId !== null &&
              selectedEquipmentIds.has(sub.requiredEquipmentId),
          ) ||
          candidateSubstitutes.find((sub) => sub.requiredEquipmentId === null);

        if (validSubstitute) {
          return {
            id: validSubstitute.id,
            name: validSubstitute.name,
            order: exercise.order, // Preserve original position in workout
            kind: validSubstitute.kind,
            imageAssetName: validSubstitute.imageAssetName,
            primaryMuscleGroup: validSubstitute.primaryMuscleGroup,
            requiredEquipmentId: validSubstitute.requiredEquipmentId,
            substitutionGroupId: validSubstitute.substitutionGroupId,
            wasSubstituted: true,
            originalExerciseId: exercise.id,
            noEquipmentAvailable: false,
          };
        }
      }
    }

    // d) No substitute found: return original with noEquipmentAvailable flag
    return {
      id: exercise.id,
      name: exercise.name,
      order: exercise.order,
      kind: exercise.kind,
      imageAssetName: exercise.imageAssetName,
      primaryMuscleGroup: exercise.primaryMuscleGroup,
      requiredEquipmentId: exercise.requiredEquipmentId,
      substitutionGroupId: exercise.substitutionGroupId,
      wasSubstituted: false,
      originalExerciseId: null,
      noEquipmentAvailable: true,
    };
  }
}
