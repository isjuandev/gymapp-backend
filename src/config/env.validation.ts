import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  JWT_SECRET: z
    .string()
    .min(8, 'JWT_SECRET is required and must be at least 8 characters long'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(
      8,
      'JWT_REFRESH_SECRET is required and must be at least 8 characters long',
    ),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues;
    const formattedErrors = issues
      .map((issue) => `  - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(
      `\n❌ Environment configuration validation error:\n${formattedErrors}\n\nPlease check your environment variables or .env file.\n`,
    );
  }

  return result.data;
}
