import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MealType, UserRole } from '@prisma/client';

describe('Nutrition (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let memberToken: string;
  let otherMemberToken: string;
  let memberId: string;
  let otherMemberId: string;
  let createdMealId: string;

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
    const memberRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Nutrition Member',
        email: `nut_member_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    memberToken = memberRes.body.accessToken;
    memberId = memberRes.body.user.id;

    // Register Other Member
    const otherRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Other Member',
        email: `nut_other_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    otherMemberToken = otherRes.body.accessToken;
    otherMemberId = otherRes.body.user.id;

    // Register Admin and update role in DB
    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Nutrition Admin',
        email: `nut_admin_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    const adminId = adminRes.body.user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { role: UserRole.ADMIN },
    });

    // Login to get token with ADMIN role payload
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminRes.body.user.email,
        password: 'Password123!',
      })
      .expect(200);

    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    if (memberId && otherMemberId) {
      await prisma.mealEntry
        .deleteMany({
          where: { userId: { in: [memberId, otherMemberId] } },
        })
        .catch(() => null);

      if (createdMealId) {
        await prisma.meal
          .delete({
            where: { id: createdMealId },
          })
          .catch(() => null);
      }

      await prisma.user
        .deleteMany({
          where: { id: { in: [memberId, otherMemberId] } },
        })
        .catch(() => null);
    }

    await app.close();
  });

  describe('Meals Catalog (CRUD & Role Protection)', () => {
    it('POST /nutrition/meals should reject non-admin with 403', async () => {
      await request(app.getHttpServer())
        .post('/nutrition/meals')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Protein Shake',
          kcal: 250,
          macros: { protein: 30, carbs: 10, fat: 3 },
          type: MealType.SNACK,
          imageAssetName: 'shake',
        })
        .expect(403);
    });

    it('POST /nutrition/meals should allow admin to create a meal', async () => {
      const res = await request(app.getHttpServer())
        .post('/nutrition/meals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Greek Yogurt & Berries Bowl',
          kcal: 320,
          macros: { protein: 22, carbs: 35, fat: 6 },
          type: MealType.BREAKFAST,
          imageAssetName: 'yogurt_bowl',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Greek Yogurt & Berries Bowl');
      expect(res.body.type).toBe(MealType.BREAKFAST);
      expect(res.body.macros).toEqual({ protein: 22, carbs: 35, fat: 6 });
      createdMealId = res.body.id;
    });

    it('GET /nutrition/meals should list meals with optional type filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/nutrition/meals?type=BREAKFAST')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const found = res.body.find((m: any) => m.id === createdMealId);
      expect(found).toBeDefined();
      expect(found.type).toBe(MealType.BREAKFAST);
    });

    it('PATCH /nutrition/meals/:id should allow admin to update a meal', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/nutrition/meals/${createdMealId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          kcal: 340,
          name: 'Greek Yogurt, Granola & Berries Bowl',
        })
        .expect(200);

      expect(res.body.kcal).toBe(340);
      expect(res.body.name).toBe('Greek Yogurt, Granola & Berries Bowl');
    });
  });

  describe('Meal Entries & Today Summary', () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    it('POST /nutrition/entries returns 404 for unknown meal', async () => {
      await request(app.getHttpServer())
        .post('/nutrition/entries')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          mealId: '11111111-1111-4111-8111-111111111111',
          date: today,
          consumed: false,
        })
        .expect(404);
    });

    it('POST /nutrition/entries creates a new entry with consumed = false', async () => {
      const res = await request(app.getHttpServer())
        .post('/nutrition/entries')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          mealId: createdMealId,
          date: today,
          consumed: false,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(memberId);
      expect(res.body.mealId).toBe(createdMealId);
      expect(res.body.consumed).toBe(false);
      expect(res.body.meal.name).toBe('Greek Yogurt, Granola & Berries Bowl');
    });

    it('POST /nutrition/entries upserts entry for same date with consumed = true', async () => {
      const res = await request(app.getHttpServer())
        .post('/nutrition/entries')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          mealId: createdMealId,
          date: today,
          consumed: true,
        })
        .expect(201);

      expect(res.body.consumed).toBe(true);

      const count = await prisma.mealEntry.count({
        where: {
          userId: memberId,
          mealId: createdMealId,
        },
      });
      expect(count).toBe(1);
    });

    it('GET /nutrition/entries?date=YYYY-MM-DD lists user entries for that date', async () => {
      const res = await request(app.getHttpServer())
        .get(`/nutrition/entries?date=${today}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].mealId).toBe(createdMealId);
      expect(res.body[0].meal).toBeDefined();
    });

    it('GET /nutrition/entries isolates data between users', async () => {
      const res = await request(app.getHttpServer())
        .get(`/nutrition/entries?date=${today}`)
        .set('Authorization', `Bearer ${otherMemberToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('GET /nutrition/entries/today/summary returns totalKcal and today entries', async () => {
      const res = await request(app.getHttpServer())
        .get('/nutrition/entries/today/summary')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalKcal');
      expect(res.body).toHaveProperty('entries');
      expect(res.body.totalKcal).toBe(340);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].meal.name).toBe(
        'Greek Yogurt, Granola & Berries Bowl',
      );
    });
  });

  describe('DELETE /nutrition/meals/:id', () => {
    it('DELETE /nutrition/meals/:id should allow admin to delete meal', async () => {
      // First clean entries associated to avoid FK cascade issues in test
      await prisma.mealEntry.deleteMany({
        where: { mealId: createdMealId },
      });

      await request(app.getHttpServer())
        .delete(`/nutrition/meals/${createdMealId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/nutrition/meals/${createdMealId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);
    });
  });
});
