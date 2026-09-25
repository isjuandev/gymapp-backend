import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExperienceLevel, GoalType } from '@prisma/client';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let memberToken: string;
  let memberId: string;
  let equipmentId: string;

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

    // Register Member
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Onboarding Member',
        email: `onboard_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    memberToken = res.body.accessToken;
    memberId = res.body.user.id;

    // Get an equipment
    const eq = await prisma.equipment.findFirst({
      where: { isAvailableAtGym: true },
    });
    if (eq) equipmentId = eq.id;
  });

  afterAll(async () => {
    if (memberId) {
      await prisma.onboardingProfile
        .deleteMany({
          where: { userId: memberId },
        })
        .catch(() => null);

      await prisma.userEquipmentPreference
        .deleteMany({
          where: { userId: memberId },
        })
        .catch(() => null);

      await prisma.user
        .deleteMany({
          where: { id: memberId },
        })
        .catch(() => null);
    }

    await app.close();
  });

  describe('GET /onboarding/me', () => {
    it('should return 404 if onboarding has not been completed', async () => {
      await request(app.getHttpServer())
        .get('/onboarding/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);
    });
  });

  describe('POST /onboarding/complete', () => {
    it('should complete onboarding, save equipment preferences, and return profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/onboarding/complete')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          goal: GoalType.LOSE_WEIGHT,
          experienceLevel: ExperienceLevel.INTERMEDIATE,
          workoutDaysPerWeek: 4,
          equipmentIds: [equipmentId],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(memberId);
      expect(res.body.goal).toBe(GoalType.LOSE_WEIGHT);
      expect(res.body.experienceLevel).toBe(ExperienceLevel.INTERMEDIATE);
      expect(res.body.workoutDaysPerWeek).toBe(4);
      expect(res.body.completedAt).not.toBeNull();
      expect(res.body.equipmentIds).toEqual([equipmentId]);

      // Verify profile is now accessible via GET /onboarding/me
      const meRes = await request(app.getHttpServer())
        .get('/onboarding/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(meRes.body.id).toBe(res.body.id);
      expect(meRes.body.workoutDaysPerWeek).toBe(4);

      // Verify user equipment preferences were also saved
      const prefRes = await request(app.getHttpServer())
        .get('/users/me/equipment-preferences')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(prefRes.body.equipmentIds).toContain(equipmentId);
    });
  });
});
