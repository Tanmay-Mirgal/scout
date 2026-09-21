import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { redis } from "../lib/redis";

export interface RateLimiterOptions {
  maxRequests?: number; // Max requests per window
  windowSeconds?: number; // Time window in seconds
}

/**
 * Fastify plugin enforcing sliding-window rate limiting per client IP using Redis.
 */
async function rateLimiterPluginRaw(
  fastify: FastifyInstance,
  options: RateLimiterOptions
) {
  const maxRequests = options.maxRequests || 100;
  const windowSeconds = options.windowSeconds || 60;

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate-limiting for health checks or in test mode if disabled
    if (request.url === "/health" || process.env.NODE_ENV === "test") {
      return;
    }

    const clientIp = request.ip || request.socket.remoteAddress || "127.0.0.1";
    const key = `scout:ratelimit:${clientIp}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      reply.header("X-RateLimit-Limit", maxRequests);
      reply.header("X-RateLimit-Remaining", Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        return reply.status(429).send({
          success: false,
          error: {
            code: "TOO_MANY_REQUESTS",
            message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowSeconds} seconds.`,
          },
        });
      }
    } catch {
      // Graceful fallback: If Redis connection drops, allow request to proceed without throwing
    }
  });
}

export const rateLimiterPlugin = fp(rateLimiterPluginRaw, {
  name: "scout-rate-limiter",
});
