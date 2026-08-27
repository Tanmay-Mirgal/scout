import { prisma } from "../lib/prisma";
import { JobService } from "../jobs/services/job.service";

/**
 * Service managing triggers, state locks, and task scheduling for asynchronous research execution.
 */
export class ResearchSessionExecutionService {
  /**
   * Starts asynchronous execution of planned tasks for a research session.
   * Validates state, locks the session to IN_PROGRESS, and enqueues all pending tasks in Redis.
   */
  static async startExecution(sessionId: string, developerUserId: string) {
    // 1. Retrieve session with planned tasks
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: { tasks: true },
    });

    if (!session) {
      const err = new Error(`ResearchSession with ID '${sessionId}' was not found.`);
      (err as any).code = "RESEARCH_SESSION_NOT_FOUND";
      throw err;
    }

    // Verify developer user ownership
    if (session.userId !== developerUserId) {
      const err = new Error("Unauthorized access to research session.");
      (err as any).code = "UNAUTHORIZED";
      throw err;
    }

    if (session.tasks.length === 0) {
      const err = new Error("No tasks are planned for this research session. Plan first.");
      (err as any).code = "RESEARCH_PLAN_NOT_FOUND";
      throw err;
    }

    // 2. Block re-execution of already completed sessions
    if (session.status === "COMPLETED") {
      const err = new Error("This research session has already completed. Cannot run again.");
      (err as any).code = "CONFLICT";
      throw err;
    }

    // 3. Lock session state to IN_PROGRESS (idempotent — safe to call again if previously failed mid-enqueue)
    await prisma.researchSession.update({
      where: { id: sessionId },
      data: { status: "IN_PROGRESS" },
    });

    // Reset FAILED or stuck IN_PROGRESS tasks back to PENDING to allow clean retry execution
    await prisma.researchTask.updateMany({
      where: {
        researchSessionId: sessionId,
        status: { in: ["FAILED", "IN_PROGRESS"] },
      },
      data: { status: "PENDING" },
    });

    // 4. Retrieve all tasks that are still PENDING (not yet enqueued or previously failed)
    const pendingTasks = await prisma.researchTask.findMany({
      where: {
        researchSessionId: sessionId,
        status: "PENDING",
      },
      orderBy: { createdAt: "asc" },
    });

    if (pendingTasks.length === 0 && session.status === "IN_PROGRESS") {
      // All tasks already enqueued — nothing to do, return current state
      return {
        researchSessionId: sessionId,
        status: "IN_PROGRESS",
        totalTasks: session.tasks.length,
        queuedTasks: 0,
        message: "All tasks already queued. Execution is underway.",
      };
    }

    // 5. Enqueue pending tasks in BullMQ
    for (const task of pendingTasks) {
      await JobService.enqueueResearchTask(sessionId, task.id);
    }

    return {
      researchSessionId: sessionId,
      status: "IN_PROGRESS",
      totalTasks: session.tasks.length,
      queuedTasks: pendingTasks.length,
    };
  }
}
export default ResearchSessionExecutionService;
