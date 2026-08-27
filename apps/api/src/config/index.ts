import "dotenv/config";
import { z } from "zod";

/**
 * Environment variable schema.
 * Validated at startup — the server will not start if required variables
 * are missing or malformed.
 */
const envSchema = z.object({
  PORT: z
    .string()
    .optional()
    .default("4000")
    .transform((val) => parseInt(val, 10)),
  HOST: z.string().optional().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
