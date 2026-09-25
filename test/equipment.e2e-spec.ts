import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EquipmentCategory, UserRole } from '@prisma/client';

describe('Equipment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let memberToken: string;
  let adminToken: string;
  let memberId: string;
  let availableEquipmentId: string;
  let unavailableEquipmentId: string;

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
        name: 'Equipment Member',
        email: `eq_member_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    memberToken = memberRes.body.accessToken;
    memberId = memberRes.body.user.id;

    // Register Admin
    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Equipment Admin',
        email: `eq_admin_${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    await prisma.user.update({
      where: { id: adminRes.body.user.id },
      data: { role: UserRole.ADMIN },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminRes.body.user.email,
        password: 'Password123!',
      })
      .expect(200);

    adminToken = loginRes.body.accessToken;

    // Get an available and unavailable equipment from DB
    const avail = await prisma.equipment.findFirst({
      where: { isAvailableAtGym: true },
    });
    if (avail) availableEquipmentId = avail.id;

    const unavail = await prisma.equipment.findFirst({
      where: { isAvailableAtGym: false },
    });
    if (unavail) unavailableEquipmentId = unavail.id;
  });

  afterAll(async () => {
    if (memberId) {
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

  describe('GET /equipment (Available Inventory)', () => {
    it('should list only available equipment', async () => {
      const res = await request(app.getHttpServer())
        .get('/equipment')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Verify that no unavailable machine is returned
      const containsUnavailable = res.body.some(
        (eq: any) => eq.id === unavailableEquipmentId,
      );
      expect(containsUnavailable).toBe(false);

      // Every returned equipment must have isAvailableAtGym = true
      res.body.forEach((eq: any) => {
        expect(eq.isAvailableAtGym).toBe(true);
      });
    });

    it('should filter by category when category query param is provided', async () => {
      const res = await request(app.getHttpServer())
        .get(`/equipment?category=${EquipmentCategory.FREE_WEIGHTS}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((eq: any) => {
        expect(eq.category).toBe(EquipmentCategory.FREE_WEIGHTS);
      });
    });
  });

  describe('PATCH /equipment/:id (Admin Inventory Management)', () => {
    it('should return 403 Forbidden for non-admin users', async () => {
      await request(app.getHttpServer())
        .patch(`/equipment/${availableEquipmentId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ isAvailableAtGym: false })
        .expect(403);
    });

    it('should allow admin to update equipment availability', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/equipment/${availableEquipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAvailableAtGym: false })
        .expect(200);

      expect(res.body.id).toBe(availableEquipmentId);
      expect(res.body.isAvailableAtGym).toBe(false);

      // Verify it is now excluded from GET /equipment
      const listRes = await request(app.getHttpServer())
        .get('/equipment')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const found = listRes.body.find(
        (eq: any) => eq.id === availableEquipmentId,
      );
      expect(found).toBeUndefined();

      // Restore availability for other tests
      await request(app.getHttpServer())
        .patch(`/equipment/${availableEquipmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isAvailableAtGym: true })
        .expect(200);
    });
  });

  describe('User Equipment Preferences', () => {
    it('GET /users/me/equipment-preferences returns empty array initially', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me/equipment-preferences')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('equipmentIds');
      expect(Array.isArray(res.body.equipmentIds)).toBe(true);
      expect(res.body.equipmentIds).toHaveLength(0);
    });

    it('PUT /users/me/equipment-preferences replaces user preferences in transaction', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/me/equipment-preferences')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          equipmentIds: [availableEquipmentId],
        })
        .expect(200);

      expect(res.body.equipmentIds).toEqual([availableEquipmentId]);

      // Verify persistence via GET
      const getRes = await request(app.getHttpServer())
        .get('/users/me/equipment-preferences')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(getRes.body.equipmentIds).toEqual([availableEquipmentId]);
    });
  });
});
