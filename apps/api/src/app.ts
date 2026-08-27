import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";
import { registerPlugins } from "./plugins";
import type { HealthResponse } from "./types";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { researchRoutes } from "./modules/research/research.routes";
import { agentsTestRoutes } from "./modules/agents/agents-test.routes";

import { bootstrapAgents } from "./agents/core/agent.bootstrap";

/**
 * Build and configure the Fastify application.
 */
export async function buildApp() {
  // Bootstrap all SCOUT agents in registry
  bootstrapAgents();

  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "warn" : "info",
    },
  });

  // Register OpenAPI / Swagger documentation plugins
  await app.register(swagger, {
    openapi: {
      info: {
        title: "SCOUT API Documentation",
        description: "API specifications for SCOUT platform",
        version: "0.1.0",
      },
      servers: [
        {
          url: `http://localhost:${process.env.API_PORT || 4000}`,
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  // Register plugins (CORS, etc.)
  await registerPlugins(app);

  // ---------------------------------------------------------------------------
  // Global Error Handler
  // ---------------------------------------------------------------------------
  app.setErrorHandler((error, request, reply) => {
    // Log the error internally
    app.log.error(error);

    // 1. Zod Validation Errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
      });
    }

    // 2. Fastify native Validation Errors (AJV)
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.validation.map((err) => ({
            field: err.instancePath.replace("/", "") || err.params.missingProperty || "field",
            message: err.message,
          })),
        },
      });
    }

    // 3. Prisma Database Error Handlers (avoid leaking internals)
    if (error.code && typeof error.code === "string" && error.code.startsWith("P2")) {
      if (error.code === "P2025") {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "The requested record could not be found",
          },
        });
      }
      if (error.code === "P2002") {
        return reply.status(409).send({
          success: false,
          error: {
            code: "CONFLICT",
            message: "A record with this value already exists",
          },
        });
      }
    }

    // 4. Custom AI/Agent and Pipeline Errors
    const customErrors: Record<string, number> = {
      AI_PROVIDER_NOT_CONFIGURED: 424,
      AI_PROVIDER_UNAVAILABLE: 502,
      AGENT_NOT_FOUND: 404,
      RESEARCH_SESSION_NOT_FOUND: 404,
      RESEARCH_PLAN_NOT_FOUND: 404,
      CONFLICT: 409,
      UNAUTHORIZED: 403,
      AI_GENERATION_FAILED: 502,
      SEARCH_PROVIDER_ERROR: 502,
    };

    if (error.code && customErrors[error.code]) {
      const statusCode = customErrors[error.code];
      return reply.status(statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    // 5. Default Internal Server Error
    return reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred on the server",
      },
    });
  });

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  // Register modular routes under versioned prefix
  await app.register(researchRoutes, { prefix: "/api/v1" });
  await app.register(agentsTestRoutes, { prefix: "/api/v1" });

  /**
   * GET /health
   * Enhanced health check endpoint with database and redis connectivity verification.
   */
  app.get<{ Reply: HealthResponse }>("/health", async (_request, reply) => {
    let databaseStatus: "connected" | "disconnected" = "disconnected";
    let redisStatus: "connected" | "disconnected" = "disconnected";

    // Check PostgreSQL connectivity via Prisma
    try {
      await prisma.$executeRawUnsafe("SELECT 1;");
      databaseStatus = "connected";
    } catch (err) {
      app.log.error("Database health check connection failed.");
    }

    // Check Redis connectivity via ioredis
    try {
      if (redis.status === "ready" || redis.status === "upstash") {
        redisStatus = "connected";
      } else {
        const res = await redis.ping();
        if (res === "PONG") {
          redisStatus = "connected";
        }
      }
    } catch (err) {
      app.log.error("Redis health check connection failed.");
    }

    const isAllConnected = databaseStatus === "connected" && redisStatus === "connected";
    const isAnyConnected = databaseStatus === "connected" || redisStatus === "connected";

    let status: HealthResponse["status"] = "ok";
    if (!isAllConnected) {
      status = isAnyConnected ? "degraded" : "error";
    }

    // Return appropriate HTTP status code
    if (status === "error") {
      reply.status(503);
    } else {
      reply.status(200);
    }

    return {
      status,
      service: "scout-api",
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        redis: redisStatus,
      },
    };
  });

  return app;
}
export default buildApp;
