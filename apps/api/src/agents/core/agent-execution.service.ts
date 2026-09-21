import { AgentRegistry } from "./agent.registry";
import type { AgentContext, AgentResult } from "./agent.types";
import { AgentStreamService } from "../../services/agent-stream.service";

/**
 * Service orchestrating validation and execution lifecycle of SCOUT agents.
 */
export class AgentExecutionService {
  /**
   * Resolves the agent from registry, validates the execution context,
   * invokes execution, and captures execution-time errors.
   */
  static async execute(agentType: string, context: AgentContext): Promise<AgentResult> {
    const sessionId = context.sessionId;

    try {
      // 1. Resolve agent from central registry
      const agent = AgentRegistry.get(agentType);

      // 2. Validate execution context parameters
      if (!context.query || context.query.trim() === "") {
        return {
          success: false,
          output: "",
          error: "Query context input parameter is required and cannot be empty.",
        };
      }

      if (sessionId) {
        AgentStreamService.publish({
          type: "AGENT_STARTED",
          sessionId,
          taskId: context.taskId,
          agentType,
          payload: {
            agentName: agent.name,
            query: context.query,
          },
        });
      }

      // 3. Invoke agent workflow
      const result = await agent.execute(context);

      if (sessionId) {
        if (result.success) {
          AgentStreamService.publish({
            type: "AGENT_COMPLETED",
            sessionId,
            taskId: context.taskId,
            agentType,
            payload: {
              agentName: agent.name,
              metadata: result.metadata,
            },
          });
        } else {
          AgentStreamService.publish({
            type: "AGENT_FAILED",
            sessionId,
            taskId: context.taskId,
            agentType,
            payload: {
              agentName: agent.name,
              error: result.error,
            },
          });
        }
      }

      return result;
    } catch (err: any) {
      // 4. Handle expected and unexpected execution failures
      const errorCode = err.code || "AGENT_EXECUTION_FAILED";
      const errorMessage = err.message || "An unexpected error occurred during agent execution.";

      if (sessionId) {
        AgentStreamService.publish({
          type: "AGENT_FAILED",
          sessionId,
          taskId: context.taskId,
          agentType,
          payload: {
            error: errorMessage,
            code: errorCode,
          },
        });
      }

      return {
        success: false,
        output: "",
        error: errorMessage,
        metadata: {
          code: errorCode,
        },
      };
    }
  }
}
export default AgentExecutionService;

