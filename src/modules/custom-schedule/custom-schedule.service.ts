import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek, Workout } from '@prisma/client';
import { UpdateCustomScheduleDto } from './dto/update-custom-schedule.dto';
import {
  CustomScheduleDayDto,
  CustomScheduleWorkoutSummaryDto,
} from './dto/custom-schedule-response.dto';

export const DAYS_OF_WEEK_ORDER: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class CustomScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all 7 weekday routine assignments for the authenticated user.
   * If a day does not yet have a record in the database, returns a default
   * unconfigured entry (workoutId: null, isRestDay: false).
   */
  async getSchedule(userId: string): Promise<CustomScheduleDayDto[]> {
    const existingAssignments =
      await this.prisma.customRoutineDayAssignment.findMany({
        where: { userId },
        include: {
          workout: {
            include: {
              exercises: true,
            },
          },
        },
      });

    const assignmentMap = new Map<DayOfWeek, (typeof existingAssignments)[0]>();
    for (const assignment of existingAssignments) {
      assignmentMap.set(assignment.dayOfWeek, assignment);
    }

    return DAYS_OF_WEEK_ORDER.map((day) => {
      const assignment = assignmentMap.get(day);
      if (assignment) {
        return this.mapToDayDto(assignment);
      }

      return {
        id: null,
        userId,
        dayOfWeek: day,
        workoutId: null,
        isRestDay: false,
        workout: null,
      };
    });
  }

  /**
   * Upserts the routine assignment for a specific day of the week.
   * Enforces mutually exclusive validation: either workoutId OR isRestDay: true, not both or neither.
   * Validates that workoutId belongs to the authenticated user (ownerUserId = userId).
   */
  async updateDaySchedule(
    userId: string,
    dayOfWeek: DayOfWeek,
    dto: UpdateCustomScheduleDto,
  ): Promise<CustomScheduleDayDto> {
    const isRest = dto.isRestDay === true;
    const hasWorkout = Boolean(
      dto.workoutId && dto.workoutId.trim().length > 0,
    );

    // Rule 3: si isRestDay es true, workoutId debe ser null y viceversa -- rechaza con 400 si vienen ambos o ninguno
    if ((isRest && hasWorkout) || (!isRest && !hasWorkout)) {
      throw new BadRequestException(
        'Validation failed: must provide either workoutId or isRestDay: true, but not both or neither',
      );
    }

    if (hasWorkout) {
      const workout = await this.prisma.workout.findUnique({
        where: { id: dto.workoutId! },
        include: { exercises: true },
      });

      if (!workout) {
        throw new NotFoundException(
          `Workout with ID '${dto.workoutId}' not found`,
        );
      }

      if (workout.ownerUserId !== userId) {
        throw new BadRequestException(
          'Workout must belong to the authenticated user and cannot be a catalog workout',
        );
      }
    }

    const assignment = await this.prisma.customRoutineDayAssignment.upsert({
      where: {
        userId_dayOfWeek: {
          userId,
          dayOfWeek,
        },
      },
      create: {
        userId,
        dayOfWeek,
        workoutId: isRest ? null : dto.workoutId,
        isRestDay: isRest,
      },
      update: {
        workoutId: isRest ? null : dto.workoutId,
        isRestDay: isRest,
      },
      include: {
        workout: {
          include: {
            exercises: true,
          },
        },
      },
    });

    return this.mapToDayDto(assignment);
  }

  private mapToDayDto(assignment: {
    id: string;
    userId: string;
    dayOfWeek: DayOfWeek;
    workoutId: string | null;
    isRestDay: boolean;
    workout?: (Workout & { exercises?: any[] }) | null;
  }): CustomScheduleDayDto {
    let workoutSummary: CustomScheduleWorkoutSummaryDto | null = null;

    if (assignment.workout) {
      workoutSummary = {
        id: assignment.workout.id,
        title: assignment.workout.title,
        durationMinutes: assignment.workout.durationMinutes,
        kcalEstimate: assignment.workout.kcalEstimate,
        imageAssetName: assignment.workout.imageAssetName,
        exercisesCount: assignment.workout.exercises?.length ?? 0,
      };
    }

    return {
      id: assignment.id,
      userId: assignment.userId,
      dayOfWeek: assignment.dayOfWeek,
      workoutId: assignment.workoutId,
      isRestDay: assignment.isRestDay,
      workout: workoutSummary,
    };
  }
}
