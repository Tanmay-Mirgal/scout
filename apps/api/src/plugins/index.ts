import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

/**
 * Register all Fastify plugins.
 * Add new plugins here as the application grows.
 */
export async function registerPlugins(app: FastifyInstance): Promise<void> {
  // CORS — permissive in development, locked down in production
  await app.register(cors, {
    origin: process.env.NODE_ENV === "production" ? false : true,
  });
}
