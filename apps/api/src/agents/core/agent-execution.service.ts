import { AgentRegistry } from "./agent.registry";
import type { AgentContext, AgentResult } from "./agent.types";
import { AgentStreamService } from "../../services/agent-stream.service";
import { TokenBudgetService } from "../../services/token-budget.service";

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

      // 3. Enforce token usage budget limit
      if (sessionId) {
        const budgetCheck = await TokenBudgetService.checkBudget(sessionId);
        if (!budgetCheck.allowed) {
          const budgetError = `Research session token budget exceeded (${budgetCheck.usedTokens}/${budgetCheck.maxTokens} tokens). Execution halted.`;
          return {
            success: false,
            output: "",
            error: budgetError,
            metadata: { code: "SESSION_BUDGET_EXCEEDED" },
          };
        }

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

      // 4. Invoke agent workflow
      const result = await agent.execute(context);

      // 5. Record LLM token consumption metrics
      if (sessionId) {
        const usage = result.metadata?.usage || { promptTokens: 120, completionTokens: 180 };
        await TokenBudgetService.recordUsage(
          sessionId,
          agentType,
          usage.promptTokens || 100,
          usage.completionTokens || 150
        );
      }

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

