import Fastify from "fastify";
import { registerPlugins } from "./plugins";
import type { HealthResponse } from "./types";

/**
 * Build and configure the Fastify application.
 * Separating app construction from server startup allows
 * the app to be imported and tested without binding to a port.
 */
export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "warn" : "info",
    },
  });

  // Register plugins (CORS, etc.)
  await registerPlugins(app);

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /health
   * Basic health check endpoint.
   */
  app.get<{ Reply: HealthResponse }>("/health", async (_request, _reply) => {
    return {
      status: "ok",
      service: "scout-api",
    };
  });

  return app;
}
