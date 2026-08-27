import { buildApp } from "./app";
import { env } from "./config";

/**
 * Server entry point.
 * Builds the Fastify application and starts listening.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });

    console.log("");
    console.log("🚀 SCOUT API is running");
    console.log(`   ➜  Local:  http://localhost:${env.API_PORT}`);
    console.log(`   ➜  Health: http://localhost:${env.API_PORT}/health`);
    console.log("");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
