import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "../config";

/**
 * Register all Fastify plugins.
 * Add new plugins here as the application grows.
 */
export async function registerPlugins(app: FastifyInstance): Promise<void> {
  // CORS configuration using the environment schema settings
  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? env.CORS_ORIGIN : true,
  });
}
