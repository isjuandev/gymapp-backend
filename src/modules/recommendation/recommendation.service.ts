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
  videoUrl?: string | null;
  imageUrl?: string | null;
  instructions: string[];
  primaryMuscleGroup: MuscleGroup;
  requiredEquipmentId: string | null;
  substitutionGroupId: string | null;
  wasSubstituted: boolean;
  originalExerciseId?: string | null;
  noEquipmentAvailable: boolean;
  minReps: number;
  maxReps: number;
  defaultSets: number;
  restSeconds: number;
  suggestedSets: number;
  suggestedMinReps: number;
  suggestedMaxReps: number;
  suggestedWeightKg: number;
  suggestedWeightLabel: string;
  userNotes?: string | null;
  personalRecord?: {
    weightKg: number;
    reps: number;
    date: string;
    estimated1RM: number;
  } | null;
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
    excludedExerciseIds: string[] = [],
  ): Promise<ResolvedExercise> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        requiredEquipment: true,
        catalogItem: {
          include: {
            equipment: true,
          },
        },
      },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID '${exerciseId}' not found`);
    }

    let chosenExercise: any = exercise;
    let wasSubstituted = false;
    let originalExerciseId: string | null = null;
    let noEquipmentAvailable = false;

    // Check if equipment is needed and if user selected it
    if (exercise.requiredEquipmentId) {
      const userPref = await this.prisma.userEquipmentPreference.findUnique({
        where: {
          userId_equipmentId: {
            userId,
            equipmentId: exercise.requiredEquipmentId,
          },
        },
      });

      if (!userPref || !userPref.isSelected) {
        // Search substitutes in same substitution group, excluding already present exercises
        if (exercise.substitutionGroupId) {
          const candidateSubstitutes = await this.prisma.exercise.findMany({
            where: {
              substitutionGroupId: exercise.substitutionGroupId,
              id: { notIn: [exercise.id, ...excludedExerciseIds] },
            },
            include: {
              requiredEquipment: true,
              catalogItem: {
                include: {
                  equipment: true,
                },
              },
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

            const validSubstitute =
              candidateSubstitutes.find(
                (sub) =>
                  sub.requiredEquipmentId !== null &&
                  selectedEquipmentIds.has(sub.requiredEquipmentId),
              ) ||
              candidateSubstitutes.find(
                (sub) => sub.requiredEquipmentId === null,
              );

            if (validSubstitute) {
              chosenExercise = validSubstitute;
              wasSubstituted = true;
              originalExerciseId = exercise.id;
            } else {
              noEquipmentAvailable = true;
            }
          } else {
            noEquipmentAvailable = true;
          }
        } else {
          noEquipmentAvailable = true;
        }
      }
    }

    const personalization = await this.calculatePersonalization(userId, chosenExercise);

    return {
      id: chosenExercise.id,
      name: chosenExercise.name,
      order: exercise.order, // Preserve original position in workout
      kind: chosenExercise.kind,
      imageAssetName: chosenExercise.imageAssetName,
      videoUrl: chosenExercise.videoUrl ?? chosenExercise.catalogItem?.videoUrl ?? null,
      imageUrl: chosenExercise.imageUrl ?? chosenExercise.catalogItem?.imageUrl ?? null,
      instructions: chosenExercise.instructions?.length
        ? chosenExercise.instructions
        : chosenExercise.catalogItem?.instructions ?? [],
      primaryMuscleGroup: chosenExercise.primaryMuscleGroup,
      requiredEquipmentId: chosenExercise.requiredEquipmentId,
      substitutionGroupId: chosenExercise.substitutionGroupId,
      wasSubstituted,
      originalExerciseId,
      noEquipmentAvailable,
      minReps: personalization.minReps,
      maxReps: personalization.maxReps,
      defaultSets: chosenExercise.defaultSets ?? 3,
      restSeconds: personalization.restSeconds,
      suggestedSets: personalization.suggestedSets,
      suggestedMinReps: personalization.minReps,
      suggestedMaxReps: personalization.maxReps,
      suggestedWeightKg: personalization.suggestedWeightKg,
      suggestedWeightLabel: personalization.suggestedWeightLabel,
      userNotes: personalization.userNotes,
      personalRecord: personalization.personalRecord,
    };
  }

  private async calculatePersonalization(userId: string, exercise: any) {
    let profile: any = null;
    let progress: any = null;
    let pr: { weightKg: number; reps: number; date: string; estimated1RM: number } | null = null;

    try {
      if (this.prisma.onboardingProfile?.findUnique) {
        profile = await this.prisma.onboardingProfile.findUnique({
          where: { userId },
        });
      }
    } catch {
      // Safe fallback
    }

    try {
      if (this.prisma.exerciseProgressState?.findUnique) {
        progress = await this.prisma.exerciseProgressState.findUnique({
          where: {
            userId_exerciseId: {
              userId,
              exerciseId: exercise.id,
            },
          },
        });
      }
    } catch {
      // Safe fallback
    }

    try {
      if (this.prisma.exerciseSetLog?.findMany) {
        const bestLogs = await this.prisma.exerciseSetLog.findMany({
          where: {
            exerciseId: exercise.id,
            workoutSession: { userId },
            isWarmup: false,
          },
          orderBy: [{ weightKg: 'desc' }, { reps: 'desc' }],
          take: 1,
        });

        if (bestLogs && bestLogs.length > 0) {
          const b = bestLogs[0];
          const est1RM = Math.round(b.weightKg * (1 + b.reps / 30) * 10) / 10;
          pr = {
            weightKg: b.weightKg,
            reps: b.reps,
            date: b.completedAt.toISOString().split('T')[0],
            estimated1RM: est1RM,
          };
        }
      }
    } catch {
      // Safe fallback
    }

    // 1. Goal-based sets and reps
    let suggestedSets = exercise.defaultSets ?? 3;
    let minReps = exercise.minReps ?? 8;
    let maxReps = exercise.maxReps ?? 12;
    let restSeconds = exercise.restSeconds ?? 90;

    if (profile?.goal === GoalType.GAIN_MUSCLE) {
      suggestedSets = 4;
      minReps = Math.max(8, exercise.minReps || 8);
      maxReps = Math.max(12, exercise.maxReps || 12);
      restSeconds = 90;
    } else if (profile?.goal === GoalType.LOSE_WEIGHT) {
      suggestedSets = 4;
      minReps = 12;
      maxReps = 15;
      restSeconds = 60;
    } else if (profile?.goal === GoalType.IMPROVE_HEALTH) {
      suggestedSets = 3;
      minReps = 10;
      maxReps = 12;
      restSeconds = 75;
    }

    // 2. Weights: check existing progress state or calculate baseline
    let suggestedWeightKg = 0;
    let suggestedWeightLabel = '0 kg';

    if (progress?.suggestedNextWeightKg && progress.suggestedNextWeightKg > 0) {
      suggestedWeightKg = Number(progress.suggestedNextWeightKg);
      suggestedWeightLabel = `${progress.currentWorkingWeightKg}->${progress.suggestedNextWeightKg} kg`;
    } else if (progress?.currentWorkingWeightKg && progress.currentWorkingWeightKg > 0) {
      suggestedWeightKg = Number(progress.currentWorkingWeightKg);
      suggestedWeightLabel = `${progress.currentWorkingWeightKg} kg`;
    } else {
      const level = profile?.experienceLevel ?? ExperienceLevel.BEGINNER;
      const eq = exercise.requiredEquipment ?? exercise.catalogItem?.equipment;
      const nameCombined = `${exercise.name} ${eq?.name ?? ''}`.toLowerCase();

      const isBodyweight =
        !exercise.requiredEquipmentId ||
        nameCombined.includes('corporal') ||
        nameCombined.includes('bodyweight') ||
        nameCombined.includes('flexiones') ||
        nameCombined.includes('plancha');
      const isDumbbell =
        nameCombined.includes('mancuerna') || nameCombined.includes('dumbbell');
      const isBarbell =
        nameCombined.includes('barra') || nameCombined.includes('barbell');
      const isCable =
        nameCombined.includes('polea') || nameCombined.includes('cable');
      const isMachine =
        nameCombined.includes('máquina') ||
        nameCombined.includes('maquina') ||
        nameCombined.includes('machine') ||
        nameCombined.includes('prensa');

      if (isBodyweight) {
        suggestedWeightKg = 0;
        suggestedWeightLabel = 'Peso corporal';
      } else if (isDumbbell) {
        if (level === ExperienceLevel.ADVANCED) {
          suggestedWeightKg = 26;
          suggestedWeightLabel = '26->32 kg';
        } else if (level === ExperienceLevel.INTERMEDIATE) {
          suggestedWeightKg = 18;
          suggestedWeightLabel = '18->22 kg';
        } else {
          suggestedWeightKg = 10;
          suggestedWeightLabel = '10->14 kg';
        }
      } else if (isBarbell) {
        if (level === ExperienceLevel.ADVANCED) {
          suggestedWeightKg = 80;
          suggestedWeightLabel = '80->95 kg';
        } else if (level === ExperienceLevel.INTERMEDIATE) {
          suggestedWeightKg = 50;
          suggestedWeightLabel = '50->60 kg';
        } else {
          suggestedWeightKg = 25;
          suggestedWeightLabel = '25->30 kg';
        }
      } else if (isCable) {
        if (level === ExperienceLevel.ADVANCED) {
          suggestedWeightKg = 35;
          suggestedWeightLabel = '35->50 kg';
        } else if (level === ExperienceLevel.INTERMEDIATE) {
          suggestedWeightKg = 20;
          suggestedWeightLabel = '20->30 kg';
        } else {
          suggestedWeightKg = 10;
          suggestedWeightLabel = '10->15 kg';
        }
      } else if (isMachine) {
        if (level === ExperienceLevel.ADVANCED) {
          suggestedWeightKg = 65;
          suggestedWeightLabel = '65->80 kg';
        } else if (level === ExperienceLevel.INTERMEDIATE) {
          suggestedWeightKg = 40;
          suggestedWeightLabel = '40->50 kg';
        } else {
          suggestedWeightKg = 20;
          suggestedWeightLabel = '20->25 kg';
        }
      } else {
        if (level === ExperienceLevel.ADVANCED) {
          suggestedWeightKg = 35;
          suggestedWeightLabel = '35 kg';
        } else if (level === ExperienceLevel.INTERMEDIATE) {
          suggestedWeightKg = 20;
          suggestedWeightLabel = '20 kg';
        } else {
          suggestedWeightKg = 10;
          suggestedWeightLabel = '10 kg';
        }
      }
    }

    return {
      suggestedSets,
      minReps,
      maxReps,
      restSeconds,
      suggestedWeightKg,
      suggestedWeightLabel,
      userNotes: progress?.notes ?? null,
      personalRecord: pr,
    };
  }
}
