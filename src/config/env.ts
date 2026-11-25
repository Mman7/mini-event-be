import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("mysql://"),
  PORT: z.coerce.number().int().positive().default(5000),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("development-only-secret-change-before-production-1234"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:5000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3001"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = envSchema.parse(process.env);
