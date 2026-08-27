import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

// Explicitly resolve the path to the centralized root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

/**
 * Environment variable schema.
 * Validated at startup — the server will not start if required variables
 * are missing or malformed.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    
    API_PORT: z
      .string()
      .optional()
      .default("4000")
      .transform((val) => parseInt(val, 10)),
    
    API_HOST: z.string().optional().default("0.0.0.0"),
    
    CORS_ORIGIN: z.string().optional().default("http://localhost:3000"),
    
    DATABASE_URL: z.string({
      required_error: "DATABASE_URL environment variable is required.",
    }).min(1, "DATABASE_URL cannot be empty."),
    
    // Redis (standard TCP connection string)
    REDIS_URL: z.string().optional(),
    
    // Upstash Redis (REST HTTP connection details)
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    
    // Groq AI Provider
    GROQ_API_KEY: z.string().optional(),
    AI_DEFAULT_PROVIDER: z.enum(["GROQ"]).optional().default("GROQ"),
    AI_DEFAULT_MODEL: z.string().optional().default("llama-3.3-70b-versatile"),

    // Search Providers
    TAVILY_API_KEY: z.string().optional(),

    // Pipeline limits
    RESEARCH_MAX_TASKS_PER_EXECUTION: z.coerce.number().optional().default(5),
    RESEARCH_MAX_SEARCH_QUERIES_PER_TASK: z.coerce.number().optional().default(3),
    RESEARCH_MAX_RESULTS_PER_QUERY: z.coerce.number().optional().default(5),
    RESEARCH_MAX_SOURCES_PER_TASK: z.coerce.number().optional().default(5),
    RESEARCH_MAX_SOURCE_CONTENT_SIZE: z.coerce.number().optional().default(100000),
    RESEARCH_REQUEST_TIMEOUT_MS: z.coerce.number().optional().default(60000),
    RESEARCH_AI_MAX_RETRIES: z.coerce.number().optional().default(3),

    // Queue and Synthesis Configs
    RESEARCH_WORKER_CONCURRENCY: z.coerce.number().min(1).optional().default(3),
    RESEARCH_JOB_ATTEMPTS: z.coerce.number().min(1).optional().default(3),
    RESEARCH_JOB_BACKOFF_MS: z.coerce.number().min(0).optional().default(5000),
    RESEARCH_SYNTHESIS_MIN_COMPLETED_TASKS: z.coerce.number().min(0).optional().default(1),
    RESEARCH_SYNTHESIS_MIN_SUPPORTED_CLAIMS: z.coerce.number().min(0).optional().default(1),
    
    // Optional Security
    JWT_SECRET: z.string().optional(),
    JWT_EXPIRES_IN: z.string().optional().default("7d"),
    
    // Observability
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .optional()
      .default("info"),
  })
  .refine(
    (data) => {
      const hasStandardRedis = !!data.REDIS_URL;
      const hasUpstashRedis = !!data.UPSTASH_REDIS_REST_URL && !!data.UPSTASH_REDIS_REST_TOKEN;
      return hasStandardRedis || hasUpstashRedis;
    },
    {
      message: "Either REDIS_URL or both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be provided to configure Redis.",
      path: ["REDIS_URL"],
    }
  );

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables configuration:");
  parsed.error.errors.forEach((err) => {
    console.error(`   ➜  ${err.path.join(".") || "Configuration"}: ${err.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
export default env;
