import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProgramCategory } from '@prisma/client';

describe('Programs & Workouts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let memberToken: string;

  let existingProgramId: string;
  let existingWorkoutId: string;

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

    // Register a member to obtain access token
    const uniqueEmail = `pw_test_${Date.now()}@example.com`;
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Programs Test Member',
        email: uniqueEmail,
        password: 'Password123!',
      })
      .expect(201);

    memberToken = regRes.body.accessToken;

    // Retrieve an existing program and workout from seed
    const program = await prisma.program.findFirst({
      include: { workouts: true },
    });
    if (program) {
      existingProgramId = program.id;
      if (program.workouts.length > 0) {
        existingWorkoutId = program.workouts[0].id;
      }
    }
  });

  afterAll(async () => {
    await prisma.user
      .deleteMany({
        where: { email: { startsWith: 'pw_test_' } },
      })
      .catch(() => null);

    await app.close();
  });

  describe('GET /programs', () => {
    it('should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/programs').expect(401);
    });

    it('should return list of programs for authenticated member', async () => {
      const response = await request(app.getHttpServer())
        .get('/programs')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('category');
    });

    it('should filter programs by category query parameter', async () => {
      const response = await request(app.getHttpServer())
        .get(`/programs?category=${ProgramCategory.WEIGHT_LOSS}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      for (const item of response.body) {
        expect(item.category).toBe(ProgramCategory.WEIGHT_LOSS);
      }
    });
  });

  describe('GET /programs/:id', () => {
    it('should return program detail including associated workouts', async () => {
      const response = await request(app.getHttpServer())
        .get(`/programs/${existingProgramId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.id).toBe(existingProgramId);
      expect(Array.isArray(response.body.workouts)).toBe(true);
      expect(response.body.workouts.length).toBeGreaterThan(0);
      expect(response.body.workouts[0]).toHaveProperty('id');
      expect(response.body.workouts[0]).toHaveProperty('durationMinutes');
    });

    it('should return 404 when program does not exist', async () => {
      const nonExistentUuid = '99999999-9999-4999-8999-999999999999';
      await request(app.getHttpServer())
        .get(`/programs/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);
    });
  });

  describe('GET /workouts/:id', () => {
    it('should return workout detail with exercises ordered by order', async () => {
      const response = await request(app.getHttpServer())
        .get(`/workouts/${existingWorkoutId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.id).toBe(existingWorkoutId);
      expect(Array.isArray(response.body.exercises)).toBe(true);

      // Verify ordering
      const exercises = response.body.exercises;
      for (let i = 0; i < exercises.length - 1; i++) {
        expect(exercises[i].order).toBeLessThanOrEqual(exercises[i + 1].order);
      }
    });

    it('should include equipment substitution metadata for exercises', async () => {
      const response = await request(app.getHttpServer())
        .get(`/workouts/${existingWorkoutId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(response.body.exercises.length).toBeGreaterThan(0);
      const firstEx = response.body.exercises[0];
      expect(firstEx).toHaveProperty('wasSubstituted');
      expect(firstEx).toHaveProperty('noEquipmentAvailable');
    });

    it('should return 404 when workout does not exist', async () => {
      const nonExistentUuid = '88888888-8888-4888-8888-888888888888';
      await request(app.getHttpServer())
        .get(`/workouts/${nonExistentUuid}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);
    });
  });

  describe('POST /programs (Admin RBAC protection)', () => {
    it('should forbid member from creating a program', async () => {
      await request(app.getHttpServer())
        .post('/programs')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Forbidden Program',
          category: ProgramCategory.HEALTH,
          durationWeeks: 4,
          level: 'BEGINNER',
          location: 'HOME',
          tagline: 'Unauthorized',
          imageAssetName: 'img',
        })
        .expect(403);
    });
  });
});
