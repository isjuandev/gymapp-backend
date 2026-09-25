import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GoalType, WorkoutSessionStatus } from '@prisma/client';

describe('Progress (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
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
        name: 'Progress User A',
        email: `prog_user_a_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Progress User B',
        email: `prog_user_b_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userBToken = resB.body.accessToken;
    userBId = resB.body.user.id;

    // Find or create workout for stats test
    const existingWorkout = await prisma.workout.findFirst();
    if (existingWorkout) {
      workoutId = existingWorkout.id;
    }
  });

  afterAll(async () => {
    // Cleanup created data
    if (userAId && userBId) {
      await prisma.workoutSession
        .deleteMany({
          where: { userId: { in: [userAId, userBId] } },
        })
        .catch(() => null);

      await prisma.goal
        .deleteMany({
          where: { userId: { in: [userAId, userBId] } },
        })
        .catch(() => null);

      await prisma.weightEntry
        .deleteMany({
          where: { userId: { in: [userAId, userBId] } },
        })
        .catch(() => null);

      await prisma.user
        .deleteMany({
          where: { id: { in: [userAId, userBId] } },
        })
        .catch(() => null);
    }

    await app.close();
  });

  describe('POST /progress/weight-entries (Weigh-in & Upsert)', () => {
    const today = new Date().toISOString();

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/progress/weight-entries')
        .send({ date: today, weightKg: 80.5 })
        .expect(401);
    });

    it('should create a new weight entry', async () => {
      const res = await request(app.getHttpServer())
        .post('/progress/weight-entries')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ date: today, weightKg: 80.5 })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(userAId);
      expect(res.body.weightKg).toBe(80.5);
    });

    it('should upsert weight entry when recorded on the same date', async () => {
      const res = await request(app.getHttpServer())
        .post('/progress/weight-entries')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ date: today, weightKg: 79.8 })
        .expect(201);

      expect(res.body.weightKg).toBe(79.8);

      // Verify that there is only 1 entry for this date
      const entries = await prisma.weightEntry.findMany({
        where: { userId: userAId },
      });
      expect(entries).toHaveLength(1);
      expect(entries[0].weightKg).toBe(79.8);
    });
  });

  describe('GET /progress/weight-entries (Range filter)', () => {
    it('should list weight entries ordered by date ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/progress/weight-entries?range=30D')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].weightKg).toBe(79.8);
    });
  });

  describe('Goals & Synchronization with WeightEntry', () => {
    let goalAId: string;

    it('GET /progress/goals/current returns 404 if user has no goals', async () => {
      await request(app.getHttpServer())
        .get('/progress/goals/current')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(404);
    });

    it('POST /progress/goals creates a new LOSE_WEIGHT goal', async () => {
      const res = await request(app.getHttpServer())
        .post('/progress/goals')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: GoalType.LOSE_WEIGHT,
          targetValue: 72.0,
          currentValue: 79.8,
          deadline: '2027-12-31T23:59:59.000Z',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(userAId);
      expect(res.body.type).toBe(GoalType.LOSE_WEIGHT);
      expect(res.body.targetValue).toBe(72.0);
      expect(res.body.currentValue).toBe(79.8);
      goalAId = res.body.id;
    });

    it('GET /progress/goals/current returns the active goal', async () => {
      const res = await request(app.getHttpServer())
        .get('/progress/goals/current')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.id).toBe(goalAId);
      expect(res.body.currentValue).toBe(79.8);
    });

    it('POST /progress/weight-entries automatically updates active LOSE_WEIGHT goal currentValue', async () => {
      // User A weighs in with 78.2 kg
      const weighInDate = new Date();
      weighInDate.setDate(weighInDate.getDate() + 1);

      await request(app.getHttpServer())
        .post('/progress/weight-entries')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          date: weighInDate.toISOString(),
          weightKg: 78.2,
        })
        .expect(201);

      // Verify the goal was updated via transaction
      const goalRes = await request(app.getHttpServer())
        .get('/progress/goals/current')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(goalRes.body.id).toBe(goalAId);
      expect(goalRes.body.currentValue).toBe(78.2);
    });

    it('PATCH /progress/goals/:id returns 403 Forbidden when modifying another user goal', async () => {
      await request(app.getHttpServer())
        .patch(`/progress/goals/${goalAId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ currentValue: 75.0 })
        .expect(403);
    });

    it('PATCH /progress/goals/:id allows owner to update goal values', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/progress/goals/${goalAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          currentValue: 77.0,
          targetValue: 70.0,
        })
        .expect(200);

      expect(res.body.id).toBe(goalAId);
      expect(res.body.currentValue).toBe(77.0);
      expect(res.body.targetValue).toBe(70.0);
    });
  });

  describe('GET /progress/stats (Monthly Metrics)', () => {
    it('returns 0 stats if user has no completed sessions this month', async () => {
      const res = await request(app.getHttpServer())
        .get('/progress/stats')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(res.body).toEqual({
        workoutsThisMonth: 0,
        activeTimeThisMonth: 0,
      });
    });

    it('returns aggregated workoutsThisMonth and activeTimeThisMonth from COMPLETED sessions', async () => {
      if (workoutId) {
        // Create 2 completed sessions for User B in current month
        const now = new Date();
        await prisma.workoutSession.createMany({
          data: [
            {
              userId: userBId,
              workoutId,
              date: now,
              status: WorkoutSessionStatus.COMPLETED,
              durationActualSeconds: 1800,
              kcalBurned: 250,
            },
            {
              userId: userBId,
              workoutId,
              date: now,
              status: WorkoutSessionStatus.COMPLETED,
              durationActualSeconds: 2400,
              kcalBurned: 350,
            },
            {
              userId: userBId,
              workoutId,
              date: now,
              status: WorkoutSessionStatus.SKIPPED,
              durationActualSeconds: 600,
            },
          ],
        });

        const res = await request(app.getHttpServer())
          .get('/progress/stats')
          .set('Authorization', `Bearer ${userBToken}`)
          .expect(200);

        expect(res.body.workoutsThisMonth).toBe(2);
        expect(res.body.activeTimeThisMonth).toBe(4200); // 1800 + 2400
      }
    });
  });
});
