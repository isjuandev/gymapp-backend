import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthRepository } from './repositories/auth.repository';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;

  const mockUser = {
    id: 'user-uuid-123',
    name: 'Juan Pérez',
    email: 'juan.perez@example.com',
    passwordHash: '$2b$12$dummyHashedPasswordForTestingPurposes123456789012345',
    avatarAssetName: null,
    goalType: null,
    joinDate: new Date('2026-01-01T00:00:00.000Z'),
    role: UserRole.MEMBER,
  };

  beforeEach(async () => {
    const mockAuthRepository = {
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      createUser: jest.fn(),
      saveRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserRefreshTokens: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-jwt-access-token'),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test_jwt_secret_key_12345';
        if (key === 'JWT_REFRESH_SECRET')
          return 'test_jwt_refresh_secret_key_12345';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepository = module.get(AuthRepository);
  });

  describe('register', () => {
    it('should successfully register a user and return tokens + user DTO', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue(mockUser);
      authRepository.saveRefreshToken.mockResolvedValue({
        id: 'token-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        revoked: false,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.register({
        name: 'Juan Pérez',
        email: 'juan.perez@example.com',
        password: 'ValidPassword123!',
      });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith(
        'juan.perez@example.com',
      );
      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Juan Pérez',
          email: 'juan.perez@example.com',
          role: UserRole.MEMBER,
        }),
      );
      expect(result.accessToken).toBe('mocked-jwt-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should throw ConflictException if email is already taken', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          name: 'Juan Pérez',
          email: 'juan.perez@example.com',
          password: 'ValidPassword123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should successfully authenticate user with correct credentials', async () => {
      const password = 'CorrectPassword123!';
      const passwordHash = await bcrypt.hash(password, 12);
      const userWithHash = { ...mockUser, passwordHash };

      authRepository.findUserByEmail.mockResolvedValue(userWithHash);
      authRepository.saveRefreshToken.mockResolvedValue({
        id: 'token-uuid',
        userId: userWithHash.id,
        tokenHash: 'hashed-token',
        revoked: false,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.login({
        email: 'juan.perez@example.com',
        password,
      });

      expect(result.accessToken).toBe('mocked-jwt-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe(userWithHash.id);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 12);
      authRepository.findUserByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash,
      });

      await expect(
        service.login({
          email: 'juan.perez@example.com',
          password: 'WrongPassword999!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should rotate refresh token and return new tokens', async () => {
      const mockRefreshTokenEntity = {
        id: 'token-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        revoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        user: mockUser,
      };

      authRepository.findRefreshToken.mockResolvedValue(mockRefreshTokenEntity);
      authRepository.saveRefreshToken.mockResolvedValue({
        ...mockRefreshTokenEntity,
        id: 'new-token-uuid',
      });

      const result = await service.refreshTokens({
        refreshToken: 'valid-refresh-token-string',
      });

      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        mockRefreshTokenEntity.id,
      );
      expect(result.accessToken).toBe('mocked-jwt-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException and revoke all user tokens on reused revoked token', async () => {
      const revokedToken = {
        id: 'token-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        revoked: true,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        user: mockUser,
      };

      authRepository.findRefreshToken.mockResolvedValue(revokedToken);

      await expect(
        service.refreshTokens({
          refreshToken: 'revoked-token-string',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(authRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      const expiredToken = {
        id: 'token-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000000), // Expired in the past
        createdAt: new Date(),
        user: mockUser,
      };

      authRepository.findRefreshToken.mockResolvedValue(expiredToken);

      await expect(
        service.refreshTokens({
          refreshToken: 'expired-token-string',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke active refresh token', async () => {
      const activeToken = {
        id: 'token-uuid',
        userId: mockUser.id,
        tokenHash: 'hashed-token',
        revoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        user: mockUser,
      };

      authRepository.findRefreshToken.mockResolvedValue(activeToken);

      const result = await service.logout({
        refreshToken: 'active-refresh-token',
      });

      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        activeToken.id,
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
