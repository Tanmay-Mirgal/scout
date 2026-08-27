import { prisma } from "../lib/prisma";
import { AgentExecutionService } from "../agents/core/agent-execution.service";

/**
 * Service orchestrating the breakdown of a ResearchSession query
 * into a plan of discrete, prioritized ResearchTasks.
 */
export class ResearchPlanningService {
  /**
   * Generates a structured research plan for a session using the OrchestratorAgent,
   * stores tasks in the database as PENDING, and sets session status to QUEUED.
   */
  static async planSession(sessionId: string, developerUserId: string) {
    // 1. Retrieve the ResearchSession
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

    // 2. Prevent duplicate planning
    if (session.tasks.length > 0) {
      const err = new Error(
        "This research session has already been planned. Duplicate planning is prevented."
      );
      (err as any).code = "CONFLICT";
      throw err;
    }

    // 3. Execute the OrchestratorAgent
    const context = {
      researchSessionId: session.id,
      researchTaskId: "00000000-0000-0000-0000-000000000000", // Mapped mock task ID for orchestration
      query: session.query,
    };

    const executionResult = await AgentExecutionService.execute("ORCHESTRATOR", context);

    if (!executionResult.success) {
      const err = new Error(executionResult.error || "Orchestrator failed to plan tasks.");
      (err as any).code = "RESEARCH_EXECUTION_FAILED";
      throw err;
    }

    // Parse the structured plan
    let plan: { objective: string; tasks: Array<{ title: string; description: string; priority: string; expectedOutput: string }> };
    try {
      plan = JSON.parse(executionResult.output);
    } catch {
      const err = new Error("Invalid structured output format from planning agent.");
      (err as any).code = "AI_GENERATION_FAILED";
      throw err;
    }

    // 5. Store research tasks in batch transaction
    const createdTasks = await prisma.$transaction(
      plan.tasks.map((task) =>
        prisma.researchTask.create({
          data: {
            researchSessionId: session.id,
            title: task.title,
            description: task.description,
            priority: task.priority as any, // Mapped to Priority DB Enum
            status: "PENDING", // Initial status
          },
        })
      )
    );

    // Track Orchestrator AgentRun linked to the first created task
    if (createdTasks.length > 0) {
      await prisma.agentRun.create({
        data: {
          researchSessionId: session.id,
          researchTaskId: createdTasks[0].id,
          agentType: "ORCHESTRATOR",
          status: "COMPLETED",
          input: { query: session.query } as any,
          output: plan as any,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    // 6. Update ResearchSession status to QUEUED
    const updatedSession = await prisma.researchSession.update({
      where: { id: session.id },
      data: {
        status: "QUEUED",
      },
    });

    return {
      researchSessionId: session.id,
      objective: plan.objective,
      status: updatedSession.status,
      tasks: createdTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
      })),
    };
  }
}
export default ResearchPlanningService;
