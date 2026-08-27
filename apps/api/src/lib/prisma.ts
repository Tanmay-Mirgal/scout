import { PrismaClient } from "@prisma/client";
import { env } from "../config";

declare global {
  // Allow global var declarations in TypeScript
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma Client instance.
 * Reuses the same instance in development live-reload to prevent
 * database connection pool exhaustion.
 */
export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
