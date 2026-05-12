import { z } from 'zod';

export const envSchema = z.object({
  PORT: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().positive()),

  DB_HOST: z.string().min(1),
  DB_PORT: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().positive()),
  DB_NAME: z.string().min(1),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  KAFKA_BROKER: z.string().min(1),
  KAFKA_GROUP_ID: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default('logging-service-client'),
});

export type EnvVars = z.infer<typeof envSchema>;
