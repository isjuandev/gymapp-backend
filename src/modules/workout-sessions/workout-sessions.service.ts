import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { WorkoutSessionsRepository } from './repositories/workout-sessions.repository';
import { WorkoutsRepository } from '../workouts/repositories/workouts.repository';
import { CreateWorkoutSessionDto } from './dto/create-workout-session.dto';
import { CompleteWorkoutSessionDto } from './dto/complete-workout-session.dto';
import { WorkoutSessionFilterDto } from './dto/workout-session-filter.dto';
import { WorkoutSessionResponseDto } from './dto/workout-session-response.dto';
import { WorkoutSessionStatus } from '@prisma/client';

@Injectable()
export class WorkoutSessionsService {
  constructor(
    private readonly workoutSessionsRepository: WorkoutSessionsRepository,
    private readonly workoutsRepository: WorkoutsRepository,
  ) {}

  /**
   * StartWorkoutSessionUseCase: Creates an in-progress workout session for the authenticated user.
   */
  async startSession(
    userId: string,
    dto: CreateWorkoutSessionDto,
  ): Promise<WorkoutSessionResponseDto> {
    const workout = await this.workoutsRepository.findById(dto.workoutId);
    if (!workout) {
      throw new NotFoundException(
        `Workout with ID '${dto.workoutId}' not found`,
      );
    }

    const session = await this.workoutSessionsRepository.create(
      userId,
      dto.workoutId,
      new Date(),
    );

    return WorkoutSessionResponseDto.fromEntity(session);
  }

  /**
   * CompleteWorkoutSessionUseCase: Validates ownership and IN_PROGRESS state, records metrics,
   * updates status to COMPLETED, and synchronizes matching daily plan if active.
   */
  async completeSession(
    id: string,
    userId: string,
    dto: CompleteWorkoutSessionDto,
  ): Promise<WorkoutSessionResponseDto> {
    const session = await this.workoutSessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Workout session with ID '${id}' not found`);
    }

    // Strict ownership verification: cannot complete another user's session
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workout session',
      );
    }

    // Must be IN_PROGRESS to complete (reject with 409 if already COMPLETED or SKIPPED)
    if (session.status !== WorkoutSessionStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Cannot complete session: current status is '${session.status}'`,
      );
    }

    const completedSession =
      await this.workoutSessionsRepository.completeSession(id, dto);

    // If an associated PlanDay exists for this workout on this date, complete it
    await this.workoutSessionsRepository.updateMatchingPlanDayToCompleted(
      userId,
      session.workoutId,
      session.date,
    );

    //TODO: al completar una sesion, si el modulo Feed existe (Prompt 10), disparar la creacion de un Post de logro

    return WorkoutSessionResponseDto.fromEntity(completedSession);
  }

  /**
   * Skip session: marks session as SKIPPED.
   */
  async skipSession(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionResponseDto> {
    const session = await this.workoutSessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Workout session with ID '${id}' not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this workout session',
      );
    }

    if (session.status === WorkoutSessionStatus.COMPLETED) {
      throw new ConflictException(
        'Cannot skip an already completed workout session',
      );
    }

    const skippedSession = await this.workoutSessionsRepository.skipSession(id);
    return WorkoutSessionResponseDto.fromEntity(skippedSession);
  }

  /**
   * Session history for the authenticated user, optionally filtered by date range.
   */
  async getUserSessions(
    userId: string,
    filter?: WorkoutSessionFilterDto,
  ): Promise<WorkoutSessionResponseDto[]> {
    const from = filter?.from ? new Date(filter.from) : undefined;
    const to = filter?.to ? new Date(filter.to) : undefined;

    const sessions =
      await this.workoutSessionsRepository.findByUserAndDateRange(
        userId,
        from,
        to,
      );

    return sessions.map((s) => WorkoutSessionResponseDto.fromEntity(s));
  }

  /**
   * Retrieve single session with ownership verification.
   */
  async getSessionById(
    id: string,
    userId: string,
  ): Promise<WorkoutSessionResponseDto> {
    const session = await this.workoutSessionsRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Workout session with ID '${id}' not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this workout session',
      );
    }

    return WorkoutSessionResponseDto.fromEntity(session);
  }
}
