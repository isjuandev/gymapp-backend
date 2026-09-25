import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Activity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

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
        name: 'Activity User A',
        email: `act_user_a_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Activity User B',
        email: `act_user_b_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userBToken = resB.body.accessToken;
    userBId = resB.body.user.id;
  });

  afterAll(async () => {
    if (userAId && userBId) {
      await prisma.activityDailySnapshot
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

  describe('POST /activity/snapshots (Single Snapshot Upsert)', () => {
    const today = '2026-09-24T12:00:00.000Z';

    it('should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/activity/snapshots')
        .send({
          date: today,
          steps: 8450,
          stepsGoal: 10000,
          caloriesActive: 450.5,
          sleepHours: 7.5,
          avgHeartRate: 72,
          distanceKm: 6.2,
        })
        .expect(401);
    });

    it('should create a new daily snapshot for User A', async () => {
      const res = await request(app.getHttpServer())
        .post('/activity/snapshots')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          date: today,
          steps: 8450,
          stepsGoal: 10000,
          caloriesActive: 450.5,
          sleepHours: 7.5,
          avgHeartRate: 72,
          distanceKm: 6.2,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(userAId);
      expect(res.body.steps).toBe(8450);
      expect(res.body.stepsGoal).toBe(10000);
      expect(res.body.caloriesActive).toBe(450.5);
      expect(res.body.sleepHours).toBe(7.5);
      expect(res.body.avgHeartRate).toBe(72);
      expect(res.body.distanceKm).toBe(6.2);
    });

    it('should upsert snapshot on same calendar day without duplicate rows', async () => {
      const eveningSync = '2026-09-24T22:30:00.000Z';
      const res = await request(app.getHttpServer())
        .post('/activity/snapshots')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          date: eveningSync,
          steps: 11200,
          stepsGoal: 10000,
          caloriesActive: 620.0,
          sleepHours: 7.5,
          avgHeartRate: 74,
          distanceKm: 8.5,
        })
        .expect(201);

      expect(res.body.steps).toBe(11200);
      expect(res.body.caloriesActive).toBe(620.0);
      expect(res.body.distanceKm).toBe(8.5);

      const records = await prisma.activityDailySnapshot.findMany({
        where: { userId: userAId },
      });
      expect(records).toHaveLength(1);
      expect(records[0].steps).toBe(11200);
    });
  });

  describe('GET /activity/snapshots (Device Restore / Range Query)', () => {
    it('should return snapshots for authenticated user within date range', async () => {
      const res = await request(app.getHttpServer())
        .get('/activity/snapshots?from=2026-09-01&to=2026-09-30')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].userId).toBe(userAId);
      expect(res.body[0].steps).toBe(11200);
    });

    it('should isolate data and not return User A snapshots to User B', async () => {
      const res = await request(app.getHttpServer())
        .get('/activity/snapshots')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /activity/snapshots/batch (Batch Sync & Transaction)', () => {
    it('should accept direct array of snapshots and save them all atomically', async () => {
      const snapshots = [
        {
          date: '2026-09-20T00:00:00.000Z',
          steps: 9000,
          stepsGoal: 10000,
          caloriesActive: 500,
          sleepHours: 8,
          avgHeartRate: 70,
          distanceKm: 6.8,
        },
        {
          date: '2026-09-21T00:00:00.000Z',
          steps: 10500,
          stepsGoal: 10000,
          caloriesActive: 550,
          sleepHours: 7.2,
          avgHeartRate: 71,
          distanceKm: 7.9,
        },
      ];

      const res = await request(app.getHttpServer())
        .post('/activity/snapshots/batch')
        .set('Authorization', `Bearer ${userBToken}`)
        .send(snapshots)
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const count = await prisma.activityDailySnapshot.count({
        where: { userId: userBId },
      });
      expect(count).toBe(2);
    });

    it('should accept wrapped object { snapshots: [...] } format', async () => {
      const payload = {
        snapshots: [
          {
            date: '2026-09-22T00:00:00.000Z',
            steps: 7800,
            stepsGoal: 10000,
            caloriesActive: 410,
            sleepHours: 6.5,
            avgHeartRate: 75,
            distanceKm: 5.5,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/activity/snapshots/batch')
        .set('Authorization', `Bearer ${userBToken}`)
        .send(payload)
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].steps).toBe(7800);
    });

    it('should rollback transaction and return 400 when an invalid item is in the batch', async () => {
      const initialCount = await prisma.activityDailySnapshot.count({
        where: { userId: userBId },
      });

      const invalidBatch = [
        {
          date: '2026-09-25T00:00:00.000Z',
          steps: 8000,
          stepsGoal: 10000,
          caloriesActive: 400,
          sleepHours: 7,
          distanceKm: 6.0,
        },
        {
          date: 'invalid-date',
          steps: -50, // invalid steps
          stepsGoal: 10000,
          caloriesActive: 400,
          sleepHours: 7,
          distanceKm: 6.0,
        },
      ];

      await request(app.getHttpServer())
        .post('/activity/snapshots/batch')
        .set('Authorization', `Bearer ${userBToken}`)
        .send(invalidBatch)
        .expect(400);

      // Verify that no snapshot from the invalid batch was committed
      const finalCount = await prisma.activityDailySnapshot.count({
        where: { userId: userBId },
      });
      expect(finalCount).toBe(initialCount);
    });
  });
});
