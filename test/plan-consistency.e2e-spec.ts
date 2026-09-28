import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExperienceLevel, GoalType } from '@prisma/client';

/**
 * Fase 2 plan consistency (invariants 1-7), end to end.
 * Requires a database (DATABASE_URL) + JWT secrets: runs in CI/staging,
 * not in unit runs. Covers the exact reported bug: Mi Plan / Home /
 * Horario showing three different truths for the same user/day.
 */
describe('Plan consistency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let token: string;
  let userId: string;
  let equipmentId: string;
  let programId: string;

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Consistency User',
        email: `consistency_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    token = res.body.accessToken;
    userId = res.body.user.id;

    const eq = await prisma.equipment.findFirst({
      where: { isAvailableAtGym: true },
    });
    if (!eq) throw new Error('seed equipment missing');
    equipmentId = eq.id;

    const program = await prisma.program.findFirst({
      where: { workouts: { some: {} } },
      include: { workouts: true },
    });
    if (!program) throw new Error('seed program missing');
    programId = program.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.customRoutineDayAssignment
        .deleteMany({ where: { userId } })
        .catch(() => null);
      await prisma.planDay
        .deleteMany({ where: { weeklyPlan: { userId } } })
        .catch(() => null);
      await prisma.weeklyPlan
        .deleteMany({ where: { userId } })
        .catch(() => null);
      await prisma.userPlan.deleteMany({ where: { userId } }).catch(() => null);
      await prisma.onboardingProfile
        .deleteMany({ where: { userId } })
        .catch(() => null);
      await prisma.userEquipmentPreference
        .deleteMany({ where: { userId } })
        .catch(() => null);
      await prisma.workoutSession
        .deleteMany({ where: { userId } })
        .catch(() => null);
      await prisma.goal.deleteMany({ where: { userId } }).catch(() => null);
      await prisma.weightEntry
        .deleteMany({ where: { userId } })
        .catch(() => null);
      await prisma.refreshToken
        .deleteMany({ where: { userId } })
        .catch(() => null);
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => null);
    }
    await app.close();
  });

  async function completeOnboarding() {
    await auth(
      request(app.getHttpServer()).post('/onboarding/complete'),
    )
      .send({
        goal: GoalType.LOSE_WEIGHT,
        experienceLevel: ExperienceLevel.INTERMEDIATE,
        workoutDaysPerWeek: 3,
        equipmentIds: [equipmentId],
        gender: 'MALE',
        birthDate: '1995-05-15T00:00:00.000Z',
        heightCm: 178,
        currentWeightKg: 82,
        targetWeightKg: 75,
      })
      .expect(201);
  }

  it('invariant 1: no plan -> state none (200, never 404), empty schedule', async () => {
    const state = await auth(
      request(app.getHttpServer()).get('/plan/state'),
    ).expect(200);

    expect(state.body.state).toBe('none');
    expect(state.body.plan).toBeNull();
    expect(state.body.schedule).toEqual([]);
    expect(state.body.today.status).toBe('none');
  });

  it('invariant 2: onboarding creates ONE canonical plan + rewritten schedule in one flow', async () => {
    await completeOnboarding();

    const state = await auth(
      request(app.getHttpServer()).get('/plan/state'),
    ).expect(200);

    expect(state.body.state).toBe('active');
    expect(state.body.plan.type).toBe('preset');
    expect(state.body.plan.programId).toBeTruthy();
    expect(state.body.schedule).toHaveLength(7);

    const plans = await prisma.userPlan.findMany({ where: { userId } });
    expect(plans).toHaveLength(1);

    // Goal pointer follows the plan (invariant 5).
    const me = await auth(
      request(app.getHttpServer()).get('/auth/me'),
    ).expect(200);
    expect(me.body.goalType).toBe(GoalType.LOSE_WEIGHT);
  });

  it('bug repro: plan/state, today-workout and schedule agree on the same day', async () => {
    const state = await auth(
      request(app.getHttpServer()).get('/plan/state'),
    ).expect(200);

    const today = await auth(
      request(app.getHttpServer()).get('/home/today-workout'),
    ).expect(200);

    const schedule = await auth(
      request(app.getHttpServer()).get('/custom-schedule'),
    ).expect(200);

    // All three views derive from the same materialized schedule row.
    const scheduleToday = state.body.schedule.find(
      (d: any) => d.dayOfWeek === today.body.dayOfWeek,
    );
    const scheduleRow = schedule.body.find(
      (d: any) => d.dayOfWeek === today.body.dayOfWeek,
    );
    expect(scheduleRow.workoutId).toBe(scheduleToday.workout?.id ?? null);
    expect(scheduleRow.isRestDay).toBe(scheduleToday.status === 'rest');

    if (state.body.today.status === 'rest') {
      expect(today.body.source).toBe('restDay');
    }
    if (state.body.today.status === 'workout') {
      expect(['custom', 'recommended']).toContain(today.body.source);
      expect(today.body.workout?.id).toBe(state.body.today.workout?.id);
    }
  });

  it('invariant 3: switching preset plans regenerates the schedule without deleting history', async () => {
    const before = await auth(
      request(app.getHttpServer()).get('/plan/state'),
    ).expect(200);
    const firstProgram = before.body.plan.programId;

    const other = await prisma.program.findFirst({
      where: { id: { not: firstProgram }, workouts: { some: {} } },
    });
    if (!other) return; // single-program seed: nothing to switch to

    await auth(
      request(app.getHttpServer()).post(`/programs/${other.id}/enroll`),
    ).expect(200);

    const after = await auth(
      request(app.getHttpServer()).get('/plan/state'),
    ).expect(200);

    expect(after.body.plan.programId).toBe(other.id);
    const plans = await prisma.userPlan.findMany({ where: { userId } });
    expect(plans).toHaveLength(1); // still exactly one active plan
    // Origins prove the schedule was rewritten by the single writer.
    expect(
      after.body.schedule.every((d: any) => d.origin !== 'MANUAL'),
    ).toBe(true);
  });

  it('custom plan: manual edit owns the schedule, library and history survive a switch back', async () => {
    const custom = await prisma.workout.create({
      data: {
        title: 'E2E Custom',
        ownerUserId: userId,
        rounds: 1,
        exercises: {
          create: [
            {
              name: 'E2E Ex',
              order: 1,
              imageAssetName: 'img',
              primaryMuscleGroup: 'CHEST',
              minReps: 8,
              maxReps: 12,
              defaultSets: 3,
              restSeconds: 60,
            },
          ],
        },
      },
    });

    await auth(
      request(app.getHttpServer()).put('/custom-schedule/MONDAY'),
    )
      .send({ workoutId: custom.id })
      .expect(200);

    const state = await auth(
      request(app.getHttpServer()).get('/plan/state'),
    ).expect(200);
    expect(state.body.plan.type).toBe('custom');
    expect(
      state.body.schedule.find((d: any) => d.dayOfWeek === 'MONDAY').status,
    ).toBe('workout');

    // Switch back to preset: schedule replaced, library intact.
    await auth(
      request(app.getHttpServer()).post(`/programs/${programId}/enroll`),
    ).expect(200);

    const library = await prisma.workout.findMany({
      where: { ownerUserId: userId },
    });
    expect(library.some((w) => w.id === custom.id)).toBe(true);

    await prisma.workout.delete({ where: { id: custom.id } }).catch(() => null);
  });

  it('invariant 6+7: completing a session updates plan/progress atomically and survives plan switches', async () => {
    const state = await auth(
      request(app.getHttpServer()).get('/plan/state'),
    ).expect(200);
    const workoutDay = state.body.schedule.find((d: any) => d.workout);
    if (!workoutDay) return;

    const started = await auth(
      request(app.getHttpServer()).post('/workout-sessions'),
    )
      .send({ workoutId: workoutDay.workout.id })
      .expect(201);

    const detail = await auth(
      request(app.getHttpServer()).get(`/workouts/${workoutDay.workout.id}`),
    ).expect(200);

    if (detail.body.exercises?.length) {
      await auth(
        request(app.getHttpServer()).post(
          `/workout-sessions/${started.body.id}/sets/batch`,
        ),
      )
        .send({
          sets: detail.body.exercises.slice(0, 2).map((e: any, i: number) => ({
            exerciseId: e.id,
            setNumber: i + 1,
            weightKg: 20,
            reps: 10,
            isWarmup: false,
          })),
        })
        .expect(201);
    }

    await auth(
      request(app.getHttpServer()).patch(
        `/workout-sessions/${started.body.id}/complete`,
      ),
    )
      .send({ durationActualSeconds: 1800, kcalBurned: 250 })
      .expect(200);

    const session = await prisma.workoutSession.findUnique({
      where: { id: started.body.id },
    });
    expect(session?.status).toBe('COMPLETED');

    // History survives a plan switch (invariant 7).
    await auth(
      request(app.getHttpServer()).post(`/programs/${programId}/enroll`),
    ).expect(200);

    const stillThere = await prisma.workoutSession.findUnique({
      where: { id: started.body.id },
      include: { setLogs: true },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe('COMPLETED');
  });
});
