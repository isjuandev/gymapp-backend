import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    name: 'E2E Member',
    email: `e2e_user_${Date.now()}@example.com`,
    password: 'ValidPassword123!',
  };

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
  });

  afterAll(async () => {
    // Cleanup created e2e user
    await prisma.user
      .deleteMany({
        where: { email: { startsWith: 'e2e_user_' } },
      })
      .catch(() => null);

    await app.close();
  });

  let accessToken: string;
  let refreshToken: string;

  describe('POST /auth/register', () => {
    it('should register a new user with valid data and return tokens + user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email.toLowerCase());
      expect(response.body.user.role).toBe('MEMBER');
      expect(response.body.user.passwordHash).toBeUndefined();

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject registration if password does not meet complexity rules', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Invalid Pass User',
          email: 'invalidpass@example.com',
          password: 'simplepassword', // missing uppercase and number
        })
        .expect(400);
    });

    it('should reject registration if email is already in use', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should log in successfully with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email.toLowerCase());
    });

    it('should fail login with incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword999!',
        })
        .expect(401);
    });
  });

  describe('GET /auth/me (Protected by JwtAuthGuard)', () => {
    it('should return user profile when providing valid JWT access token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUser.email.toLowerCase());
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should reject request without Bearer token with 401 Unauthorized', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should rotate refresh token and issue a new pair', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      const newRefreshToken = response.body.refreshToken;
      expect(newRefreshToken).not.toBe(refreshToken);

      // Previous refresh token is now rotated (revoked) and cannot be reused
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      refreshToken = newRefreshToken;
    });
  });

  describe('POST /auth/logout', () => {
    it('should invalidate the refresh token on logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Attempting to refresh with the logged out token must fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
