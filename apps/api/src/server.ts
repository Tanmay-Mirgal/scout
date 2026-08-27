import { buildApp } from "./app";
import { env } from "./config";

/**
 * Server entry point.
 * Builds the Fastify application and starts listening.
 */
async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });

    console.log("");
    console.log("🚀 SCOUT API is running");
    console.log(`   ➜  Local:  http://localhost:${env.PORT}`);
    console.log(`   ➜  Health: http://localhost:${env.PORT}/health`);
    console.log("");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
