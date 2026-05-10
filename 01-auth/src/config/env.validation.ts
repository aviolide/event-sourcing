import { z } from 'zod';

export const envSchema = z.object({
  // ================================
  // SERVER CONFIG
  // ================================
  PORT: z.string().optional(),

  // ================================
  // POSTGRES
  // ================================
  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.coerce.number(),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  DB_USERNAME: z.string().min(1, "DB_USERNAME is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),

  // ================================
  // KAFKA
  // ================================
  KAFKA_BROKER: z.string(),
  KAFKA_CLIENT_ID: z.string(),
  // ================================
  // JWT
  // ================================
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters for security"),
  
  JWT_EXPIRES_IN: z
    .string()
    .default("15m"),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters for security"),

  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default("7d"),
});

export type EnvVars = z.infer<typeof envSchema>;
