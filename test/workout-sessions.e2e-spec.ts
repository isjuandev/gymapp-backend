import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkoutSessionStatus } from '@prisma/client';

describe('Workout Sessions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let workoutId: string;

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

    // Register User A
    const resA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'User A',
        email: `usera_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'User B',
        email: `userb_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userBToken = resB.body.accessToken;

    // Get an existing workout
    const workout = await prisma.workout.findFirst();
    if (workout) {
      workoutId = workout.id;
    }
  });

  afterAll(async () => {
    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [
              // will match via startswith
            ],
          },
        },
      })
      .catch(() => null);

    await prisma.workoutSession
      .deleteMany({
        where: { userId: userAId },
      })
      .catch(() => null);

    await app.close();
  });

  let activeSessionId: string;

  describe('POST /workout-sessions (StartWorkoutSessionUseCase)', () => {
    it('should start a session with IN_PROGRESS status and JWT userId', async () => {
      const response = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ workoutId })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(userAId);
      expect(response.body.workoutId).toBe(workoutId);
      expect(response.body.status).toBe(WorkoutSessionStatus.IN_PROGRESS);

      activeSessionId = response.body.id;
    });

    it('should return 404 if workoutId does not exist', async () => {
      await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ workoutId: '99999999-9999-4999-8999-999999999999' })
        .expect(404);
    });
  });

  describe('Ownership protection (403 Forbidden)', () => {
    it('should forbid User B from getting User A session', async () => {
      await request(app.getHttpServer())
        .get(`/workout-sessions/${activeSessionId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(403);
    });

    it('should forbid User B from completing User A session', async () => {
      await request(app.getHttpServer())
        .patch(`/workout-sessions/${activeSessionId}/complete`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          durationActualSeconds: 2400,
          kcalBurned: 350,
        })
        .expect(403);
    });

    it('should forbid User B from skipping User A session', async () => {
      await request(app.getHttpServer())
        .patch(`/workout-sessions/${activeSessionId}/skip`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(403);
    });
  });

  describe('PATCH /workout-sessions/:id/complete (CompleteWorkoutSessionUseCase)', () => {
    it('should complete session successfully and save metrics', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/workout-sessions/${activeSessionId}/complete`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          durationActualSeconds: 2800,
          kcalBurned: 410,
          avgHeartRate: 140,
        })
        .expect(200);

      expect(response.body.id).toBe(activeSessionId);
      expect(response.body.status).toBe(WorkoutSessionStatus.COMPLETED);
      expect(response.body.durationActualSeconds).toBe(2800);
      expect(response.body.kcalBurned).toBe(410);
      expect(response.body.avgHeartRate).toBe(140);
    });

    it('should reject with 409 Conflict if trying to complete an already completed session', async () => {
      await request(app.getHttpServer())
        .patch(`/workout-sessions/${activeSessionId}/complete`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          durationActualSeconds: 2900,
          kcalBurned: 420,
        })
        .expect(409);
    });
  });

  describe('PATCH /workout-sessions/:id/skip', () => {
    it('should mark a session as SKIPPED', async () => {
      // Create another session for User A
      const startRes = await request(app.getHttpServer())
        .post('/workout-sessions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ workoutId })
        .expect(201);

      const skipSessionId = startRes.body.id;

      const response = await request(app.getHttpServer())
        .patch(`/workout-sessions/${skipSessionId}/skip`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(response.body.status).toBe(WorkoutSessionStatus.SKIPPED);
    });
  });

  describe('GET /workout-sessions', () => {
    it('should return session history for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/workout-sessions')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      for (const session of response.body) {
        expect(session.userId).toBe(userAId);
      }
    });
  });
});
