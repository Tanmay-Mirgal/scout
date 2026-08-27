import { researchQueue, synthesisQueue } from "../queues/research.queue";
import { env } from "../../config";
import type { JobPayload } from "../types/job.types";

/**
 * Service managing job dispatching and queue insertion operations.
 * Handles deterministic naming for idempotency and duplicate job prevention.
 *
 * NOTE: BullMQ job IDs must not contain colons (`:`). Underscores are used instead.
 */
export class JobService {
  /**
   * Enqueues a single research task job to be processed.
   * Utilizes task ID as deterministic job ID to prevent duplicate processing queues.
   */
  static async enqueueResearchTask(sessionId: string, taskId: string) {
    const payload: JobPayload = {
      type: "RESEARCH_TASK",
      researchSessionId: sessionId,
      researchTaskId: taskId,
    };

    const jobId = `research_task_${taskId}`;

    // Remove any stale job with the same deterministic ID so BullMQ accepts re-enqueue.
    // This handles cases where a previously failed/completed job blocks retry.
    try {
      const existingJob = await researchQueue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {
      // Non-critical — proceed even if removal fails
    }

    console.log(`[Queue] Enqueuing RESEARCH_TASK job for task: ${taskId} (Session: ${sessionId})`);

    const job = await researchQueue.add(
      "RESEARCH_TASK",
      payload,
      {
        jobId, // Deterministic duplicate protection (no colons — BullMQ forbids them)
        attempts: env.RESEARCH_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: env.RESEARCH_JOB_BACKOFF_MS,
        },
      }
    );

    return job;
  }

  /**
   * Enqueues the final report synthesis job.
   * Utilizes session ID as deterministic job ID to prevent duplicate synthesis tasks.
   */
  static async enqueueSynthesis(sessionId: string) {
    const payload: JobPayload = {
      type: "SYNTHESIS",
      researchSessionId: sessionId,
    };

    console.log(`[Queue] Enqueuing SYNTHESIS job for session: ${sessionId}`);

    const jobId = `synthesis_${sessionId}`;

    // Remove any stale synthesis job with the same ID before re-adding
    try {
      const existingJob = await synthesisQueue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {
      // Non-critical
    }

    const job = await synthesisQueue.add(
      "SYNTHESIS",
      payload,
      {
        jobId, // Deterministic duplicate protection (no colons — BullMQ forbids them)
        attempts: env.RESEARCH_JOB_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: env.RESEARCH_JOB_BACKOFF_MS,
        },
      }
    );

    return job;
  }
}
