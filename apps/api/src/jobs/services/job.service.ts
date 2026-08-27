import { researchQueue } from "../queues/research.queue";
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

    console.log(`[Queue] Enqueuing RESEARCH_TASK job for task: ${taskId} (Session: ${sessionId})`);

    const job = await researchQueue.add(
      "RESEARCH_TASK",
      payload,
      {
        jobId: `research_task_${taskId}`, // Deterministic duplicate protection (no colons — BullMQ forbids them)
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

    const job = await researchQueue.add(
      "SYNTHESIS",
      payload,
      {
        jobId: `synthesis_${sessionId}`, // Deterministic duplicate protection (no colons — BullMQ forbids them)
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
