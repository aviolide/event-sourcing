import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.string().optional(),
  DB_HOST: z.string(),
  DB_PORT: z.string().transform(Number),
  DB_NAME: z.string(),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
  KAFKA_BROKER: z.string(),
  KAFKA_CLIENT_ID: z.string().default('projections-service-client'),
  KAFKA_GROUP_ID: z.string().default('projections-group'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvVars = z.infer<typeof envSchema>;
