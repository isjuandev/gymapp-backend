import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Plan (e2e)', () => {
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
        name: 'Plan User A',
        email: `plan_user_a_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userAToken = resA.body.accessToken;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Plan User B',
        email: `plan_user_b_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    userBToken = resB.body.accessToken;

    // Get an existing workout
    const workout = await prisma.workout.findFirst();
    if (workout) {
      workoutId = workout.id;
    }

    // Provision onboarding profile for User A so RecommendationService can auto-generate plans
    await prisma.onboardingProfile.create({
      data: {
        userId: userAId,
        goal: 'LOSE_WEIGHT',
        experienceLevel: 'BEGINNER',
        workoutDaysPerWeek: 4,
        completedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.planDay
      .deleteMany({
        where: { weeklyPlan: { userId: userAId } },
      })
      .catch(() => null);

    await prisma.weeklyPlan
      .deleteMany({
        where: { userId: userAId },
      })
      .catch(() => null);

    await prisma.onboardingProfile
      .deleteMany({
        where: { userId: userAId },
      })
      .catch(() => null);

    await prisma.user
      .deleteMany({
        where: {
          id: {
            in: [userAId, userBToken ? undefined : ''].filter(
              Boolean,
            ) as string[],
          },
        },
      })
      .catch(() => null);

    await app.close();
  });

  let firstDayId: string;

  describe('GET /plan/current', () => {
    it('should auto-generate and return WeeklyPlan for current week (Mon..Sun)', async () => {
      const response = await request(app.getHttpServer())
        .get('/plan/current')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.userId).toBe(userAId);
      expect(response.body).toHaveProperty('weekStartDate');
      expect(Array.isArray(response.body.days)).toBe(true);
      expect(response.body.days.length).toBe(7);

      firstDayId = response.body.days[0].id;
    });

    it('should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/plan/current').expect(401);
    });
  });

  describe('GET /plan?weekStartDate=YYYY-MM-DD', () => {
    it('should return weekly plan for specific week', async () => {
      const response = await request(app.getHttpServer())
        .get('/plan?weekStartDate=2026-09-21')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.days.length).toBe(7);
    });
  });

  describe('PATCH /plan/days/:planDayId (Rescheduling & Ownership)', () => {
    it('should allow user A to assign a workout to a plan day', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/plan/days/${firstDayId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          workoutId,
        })
        .expect(200);

      expect(response.body.id).toBe(firstDayId);
      expect(response.body.workoutId).toBe(workoutId);
      expect(response.body.isRestDay).toBe(false);
    });

    it('should forbid user B from modifying user A plan day with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .patch(`/plan/days/${firstDayId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          isRestDay: true,
        })
        .expect(403);
    });

    it('should allow user A to reset day to rest day', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/plan/days/${firstDayId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          isRestDay: true,
        })
        .expect(200);

      expect(response.body.id).toBe(firstDayId);
      expect(response.body.isRestDay).toBe(true);
      expect(response.body.workoutId).toBeNull();
    });

    it('should return 404 when plan day does not exist', async () => {
      const nonExistentUuid = '99999999-9999-4999-8999-999999999999';
      await request(app.getHttpServer())
        .patch(`/plan/days/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ isRestDay: true })
        .expect(404);
    });
  });
});
