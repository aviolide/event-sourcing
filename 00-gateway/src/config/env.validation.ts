import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()),

  AUTH_SERVICE_URL: z.string(),
  WALLET_SERVICE_URL: z.string(),
  PAYMENTS_SERVICE_URL: z.string(),

  JWT_SECRET: z.string().min(32),

  CORS_ORIGINS: z.string().optional().default(''),

  RATE_LIMIT_WINDOW_MS: z.string().optional().default('60000'),
  RATE_LIMIT_MAX: z.string().optional().default('120'),
});

export type EnvVars = z.infer<typeof envSchema>;
