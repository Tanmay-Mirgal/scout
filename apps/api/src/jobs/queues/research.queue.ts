import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../../config";

/**
 * Creates a standard ioredis connection client for BullMQ.
 * Sets maxRetriesPerRequest to null as required by BullMQ worker/queue interfaces.
 */
export function getRedisConnection(): IORedis {
  if (env.REDIS_URL && env.REDIS_URL.trim() !== "" && (env.REDIS_URL.startsWith("redis://") || env.REDIS_URL.startsWith("rediss://"))) {
    return new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
    });
  }

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const host = env.UPSTASH_REDIS_REST_URL.replace("https://", "");
    const tcpUrl = `rediss://default:${env.UPSTASH_REDIS_REST_TOKEN}@${host}:6379`;
    return new IORedis(tcpUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
    });
  }

  return new IORedis("redis://localhost:6379", {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
  });
}

// Instantiate the Queue
export const researchQueue = new Queue("research-queue", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export default researchQueue;
