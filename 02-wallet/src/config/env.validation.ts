import { z } from 'zod';

export const envSchema = z.object({
  // --- APP ---
  PORT: z.string(),
  SERVICE_NAME: z.string().default("wallet-service"),

  // --- DATABASE ---
  DB_HOST: z.string(),
  DB_PORT: z.string().transform(Number),
  DB_NAME: z.string(),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),

  // --- KAFKA ---
  KAFKA_BROKER: z.string(),
  KAFKA_CLIENT_ID: z.string().default("wallet-service-client"),
  KAFKA_GROUP_ID: z.string(),

  // --- SECURITY ---
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});
