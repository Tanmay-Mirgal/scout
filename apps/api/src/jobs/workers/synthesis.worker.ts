import { Worker } from "bullmq";
import { prisma } from "../../lib/prisma";
import { getRedisConnection } from "../queues/research.queue";
import { AgentRegistry } from "../../agents/core/agent.registry";
import { env } from "../../config";
import type { SynthesisJobPayload } from "../types/job.types";

/**
 * Main job execution handler for SYNTHESIS jobs.
 * Extracted as a named export to allow clean unit/integration testing without Redis.
 */
export const synthesisJobHandler = async (job: any) => {
  if (job.name !== "SYNTHESIS") {
    return;
  }

  const { researchSessionId } = job.data as SynthesisJobPayload;

  console.log(`[Worker] Started SYNTHESIS job ${job.id} for Session: ${researchSessionId}`);

  // 1. Retrieve session and details
  const session = await prisma.researchSession.findUnique({
    where: { id: researchSessionId },
    include: { reports: true, tasks: true },
  });

  if (!session) {
    console.error(`[Worker] Non-retryable error: ResearchSession ${researchSessionId} not found in database.`);
    return;
  }

  // 2. Prevent duplicate report synthesis
  const existingCompletedReport = session.reports.find((r) => r.status === "COMPLETED");
  if (existingCompletedReport) {
    console.log(`[Worker] Report already COMPLETED for session ${researchSessionId}. Skipping synthesis.`);
    return;
  }

  // 3. Verify minimum evidence requirements before generating report
  const supportedClaimsCount = await prisma.claim.count({
    where: { researchSessionId, status: "SUPPORTED" },
  });

  const minClaims = env.RESEARCH_SYNTHESIS_MIN_SUPPORTED_CLAIMS ?? 1;

  if (supportedClaimsCount < minClaims) {
    console.log(`[Worker] Insufficient supported claims (${supportedClaimsCount}/${minClaims}). Marking session as FAILED.`);
    
    await prisma.researchSession.update({
      where: { id: researchSessionId },
      data: { status: "FAILED" },
    });

    // Track failed run in AgentRun
    await prisma.agentRun.create({
      data: {
        researchSessionId,
        researchTaskId: "00000000-0000-0000-0000-000000000000",
        agentType: "SYNTHESIS",
        status: "FAILED",
        input: { reason: "Insufficient supported claims to synthesize a valid final report." } as any,
        error: `Insufficient supported claims. Found: ${supportedClaimsCount}, Required: ${minClaims}`,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return;
  }

  // 4. Create running AgentRun log for synthesis phase
  const agentRun = await prisma.agentRun.create({
    data: {
      researchSessionId,
      researchTaskId: "00000000-0000-0000-0000-000000000000",
      agentType: "SYNTHESIS",
      status: "RUNNING",
      input: { researchSessionId } as any,
      startedAt: new Date(),
    },
  });

  // 5. Invoke SynthesisAgent
  try {
    const synthesisAgent = AgentRegistry.get("SYNTHESIS");
    const agentResult = await synthesisAgent.execute({
      researchSessionId,
      researchTaskId: "00000000-0000-0000-0000-000000000000",
      query: session.query,
    });

    if (!agentResult.success) {
      throw new Error(agentResult.error || "Agent report synthesis failed.");
    }

    const reportData = JSON.parse(agentResult.output);

    // 6. Persist Report in database
    const completedTasks = session.tasks.filter((t) => t.status === "COMPLETED").length;
    const failedTasks = session.tasks.filter((t) => t.status === "FAILED").length;

    // Upsert report row for this session
    const existingReport = session.reports[0];

    if (existingReport) {
      await prisma.report.update({
        where: { id: existingReport.id },
        data: {
          title: reportData.title || "SCOUT Intelligence Research Report",
          content: agentResult.output,
          summary: reportData.executiveSummary || null,
          status: "COMPLETED",
          metadata: {
            completedTasks,
            failedTasks,
            model: env.AI_DEFAULT_MODEL,
            provider: env.AI_DEFAULT_PROVIDER,
          },
        },
      });
    } else {
      await prisma.report.create({
        data: {
          researchSessionId,
          title: reportData.title || "SCOUT Intelligence Research Report",
          content: agentResult.output,
          summary: reportData.executiveSummary || null,
          status: "COMPLETED",
          metadata: {
            completedTasks,
            failedTasks,
            model: env.AI_DEFAULT_MODEL,
            provider: env.AI_DEFAULT_PROVIDER,
          },
        },
      });
    }

    // 7. Update session status
    await prisma.researchSession.update({
      where: { id: researchSessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Update AgentRun
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "COMPLETED",
        output: reportData as any,
        completedAt: new Date(),
      },
    });

    console.log(`[Worker] Successfully completed final report synthesis for session ${researchSessionId}`);
  } catch (err: any) {
    console.error(`[Worker] Attempt to synthesize report failed for session: ${researchSessionId}. Error: ${err.message}`);

    // Update AgentRun log to FAILED
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        error: err.message,
        completedAt: new Date(),
      },
    });

    // Update Session status to FAILED
    await prisma.researchSession.update({
      where: { id: researchSessionId },
      data: { status: "FAILED" },
    });

    throw err;
  }
};

/**
 * Worker processing SYNTHESIS jobs from the queue.
 */
export const synthesisWorker = new Worker(
  "synthesis-queue",
  synthesisJobHandler,
  {
    connection: getRedisConnection(),
  }
);

synthesisWorker.on("completed", (job) => {
  console.log(`[Worker] SYNTHESIS job ${job.id} completed successfully.`);
});

synthesisWorker.on("failed", (job, err) => {
  console.error(`[Worker] SYNTHESIS job ${job?.id} failed permanently. Error: ${err.message}`);
});
