import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";
import { env } from "../config";

declare global {
  // Allow global var declarations in TypeScript
  // eslint-disable-next-line no-var
  var redis: any;
}

/**
 * Singleton Redis instance supporting either Upstash Serverless Redis (REST)
 * or standard local/cloud Redis (TCP via ioredis).
 */
export let redis: any;

if (global.redis) {
  redis = global.redis;
} else {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    console.log("🔌 Initializing Upstash Serverless Redis client (HTTP REST)...");
    redis = new UpstashRedis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    // Add custom status for runtime health check checks
    redis.status = "upstash";
  } else if (env.REDIS_URL) {
    console.log("🔌 Initializing standard ioredis client (TCP socket)...");
    redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      retryStrategy(times) {
        // Exponential backoff, up to 3 seconds between retries
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
    });

    redis.on("connect", () => {
      console.log("🔌 Redis TCP connection established successfully");
    });

    redis.on("error", (err: Error) => {
      console.error("❌ Redis TCP connection error:", err.message);
    });
    
    redis.status = "ready";
  }

  if (env.NODE_ENV !== "production") {
    global.redis = redis;
  }
}

export default redis;
