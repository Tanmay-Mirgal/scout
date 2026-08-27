import dotenv from "dotenv";
import path from "path";

// Explicitly load configuration from root .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { bootstrapAgents } from "./agents/core/agent.bootstrap";

// Centrally register all SCOUT agents before workers boot/bind
bootstrapAgents();

import { researchTaskWorker } from "./jobs/workers/research-task.worker";
import { synthesisWorker } from "./jobs/workers/synthesis.worker";

console.log("==================================================");
console.log("🚀 SCOUT Background Worker Process Started");
console.log(`   - Environment: ${process.env.NODE_ENV || "development"}`);
console.log("==================================================");

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Shutting down worker process gracefully...`);
  
  try {
    await Promise.all([
      researchTaskWorker.close(),
      synthesisWorker.close(),
    ]);
    console.log("🔌 Redis worker connections closed cleanly. Exiting.");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Error during worker shutdown:", err.message);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
