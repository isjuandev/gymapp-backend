import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('should validate and parse valid environment variables', () => {
    const validConfig = {
      NODE_ENV: 'development',
      PORT: '3000',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
      JWT_SECRET: 'jwt_secret_valid_123',
      JWT_REFRESH_SECRET: 'jwt_refresh_secret_valid_123',
    };

    const parsed = validateEnv(validConfig);
    expect(parsed.PORT).toBe(3000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.DATABASE_URL).toBe(
      'postgresql://user:pass@localhost:5432/testdb',
    );
    expect(parsed.JWT_SECRET).toBe('jwt_secret_valid_123');
    expect(parsed.JWT_REFRESH_SECRET).toBe('jwt_refresh_secret_valid_123');
  });

  it('should throw clear error when DATABASE_URL is missing or invalid', () => {
    const invalidConfig = {
      PORT: '3000',
      JWT_SECRET: 'jwt_secret_valid_123',
      JWT_REFRESH_SECRET: 'jwt_refresh_secret_valid_123',
    };

    expect(() => validateEnv(invalidConfig)).toThrow(
      /Environment configuration validation error/,
    );
    expect(() => validateEnv(invalidConfig)).toThrow(/DATABASE_URL/);
  });

  it('should throw clear error when JWT_SECRET is too short', () => {
    const invalidConfig = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
      JWT_SECRET: 'short',
      JWT_REFRESH_SECRET: 'jwt_refresh_secret_valid_123',
    };

    expect(() => validateEnv(invalidConfig)).toThrow(/JWT_SECRET/);
  });
});
