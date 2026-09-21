import { ResearchSessionExecutionService } from "../../services/research-session-execution.service";
import { Worker } from "bullmq";
import { prisma } from "../../lib/prisma";
import { getRedisConnection } from "../queues/research.queue";
import { ResearchExecutionService } from "../../services/research-execution.service";
import { JobService } from "../services/job.service";
import { env } from "../../config";
import { redis } from "../../lib/redis";
import type { ResearchTaskJobPayload } from "../types/job.types";

/**
 * Main job execution handler for RESEARCH_TASK jobs.
 * Extracted as a named export to allow clean unit/integration testing without Redis.
 */
export const researchTaskJobHandler = async (job: any) => {
  if (job.name !== "RESEARCH_TASK") {
    return;
  }

  const { researchSessionId, researchTaskId } = job.data as ResearchTaskJobPayload;

  console.log(`[Worker] Started RESEARCH_TASK job ${job.id} for Task: ${researchTaskId} (Session: ${researchSessionId}) - Attempt #${job.attemptsMade + 1}`);

  // 1. Validate payload and entities
  const task = await prisma.researchTask.findUnique({
    where: { id: researchTaskId },
  });

  if (!task) {
    console.error(`[Worker] Non-retryable error: ResearchTask ${researchTaskId} not found in database.`);
    return; // Do not retry if entity does not exist
  }

  // 2. Prevent duplicate execution of completed tasks
  if (task.status === "COMPLETED") {
    console.log(`[Worker] Task ${researchTaskId} is already COMPLETED. Skipping execution.`);
    return;
  }

  // 3. Delegate execution to the core pipeline service
  try {
    await ResearchExecutionService.executeTask(researchSessionId, researchTaskId);
    console.log(`[Worker] Successfully completed RESEARCH_TASK: ${researchTaskId}`);
  } catch (err: any) {
    console.error(`[Worker] Attempt #${job.attemptsMade + 1} failed for Task: ${researchTaskId}. Error: ${err.message}`);
    throw err; // Re-throw to let BullMQ handle attempts/retries
  }

  // 4. Post-Task Completion Checks: Check if all tasks in the session are finished
  await ResearchSessionExecutionService.evaluateSessionTerminalState(researchSessionId);
};

/**
 * Worker processing RESEARCH_TASK jobs from the queue.
 */
export const researchTaskWorker = new Worker(
  "research-queue",
  researchTaskJobHandler,
  {
    connection: getRedisConnection(),
    concurrency: env.RESEARCH_WORKER_CONCURRENCY,
  }
);


  const completedTasksCount = allTasks.filter((t) => t.status === "COMPLETED").length;
  const failedTasksCount = allTasks.filter((t) => t.status === "FAILED").length;

  const minCompleted = env.RESEARCH_SYNTHESIS_MIN_COMPLETED_TASKS ?? 1;

  if (completedTasksCount >= minCompleted) {
    // Check if report synthesis was already enqueued or exists to avoid duplicate synthesis runs
    const existingReport = await prisma.report.findFirst({
      where: { researchSessionId: sessionId },
    });

    if (existingReport) {
      console.log(`[Worker] Report already exists/is generating for session ${sessionId}. Skipping duplicate synthesis trigger.`);
      return;
    }

    console.log(`[Worker] Sufficient tasks completed (${completedTasksCount}/${totalTasks}). Running verification step before synthesis.`);

    // Only one terminal worker may verify and enqueue synthesis for a session.
    const lockKey = `research:verification:${sessionId}`;
    const lockToken = `${process.pid}:${Date.now()}:${Math.random()}`;
    const acquired = await redis.set(lockKey, lockToken, "EX", 300, "NX");
    if (acquired !== "OK") {
      console.log(`[Worker] Verification is already running for session ${sessionId}. Skipping duplicate terminal trigger.`);
      return;
    }

    try {
      // Verification Scout step: evaluate claim consistency across sources before final synthesis
      try {
        await ResearchExecutionService.executeSessionVerification(sessionId);
      } catch (err: any) {
        console.error(`[Worker] Verification step failed for session ${sessionId}: ${err.message}. Proceeding to synthesis.`);
      }

      console.log(`[Worker] Enqueuing SYNTHESIS job.`);
      await JobService.enqueueSynthesis(sessionId);
    } finally {
      // Delete only our lock, so an expired/reacquired lock is never removed by this worker.
      if (redis.status === "upstash") {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          [lockKey],
          [lockToken]
        );
      } else {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockToken
        );
      }
    }
  } else {
    // Insufficient evidence/completed tasks. Mark session as FAILED.
    console.log(`[Worker] Insufficient completed tasks (${completedTasksCount}/${totalTasks}). Minimum required: ${minCompleted}. Marking session as FAILED.`);
    
    await prisma.researchSession.update({
      where: { id: sessionId },
      data: {
        status: "FAILED",
        completedAt: null,
      },
    });

    const firstTaskId = allTasks[0]?.id;

    // Create a failed AgentRun log for Synthesis tracking
    if (firstTaskId) {
      await prisma.agentRun.create({
        data: {
          researchSessionId: sessionId,
          researchTaskId: firstTaskId, // Synthesized root task ID
          agentType: "SYNTHESIS",
          status: "FAILED",
          input: { reason: "Insufficient completed research tasks to trigger report synthesis." } as any,
          error: `Insufficient completed tasks. Completed: ${completedTasksCount}, Failed: ${failedTasksCount}, Required: ${minCompleted}`,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }
  }
}

// Log worker events for observability
researchTaskWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} of type ${job.name} completed successfully.`);
});

researchTaskWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} of type ${job?.name} failed permanently. Error: ${err.message}`);
});
