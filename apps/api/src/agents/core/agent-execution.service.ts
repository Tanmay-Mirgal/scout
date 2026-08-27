import { AgentRegistry } from "./agent.registry";
import type { AgentContext, AgentResult } from "./agent.types";

/**
 * Service orchestrating validation and execution lifecycle of SCOUT agents.
 */
export class AgentExecutionService {
  /**
   * Resolves the agent from registry, validates the execution context,
   * invokes execution, and captures execution-time errors.
   */
  static async execute(agentType: string, context: AgentContext): Promise<AgentResult> {
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

      // 3. Invoke agent workflow
      const result = await agent.execute(context);
      return result;
    } catch (err: any) {
      // 4. Handle expected and unexpected execution failures
      const errorCode = err.code || "AGENT_EXECUTION_FAILED";
      
      return {
        success: false,
        output: "",
        error: err.message || "An unexpected error occurred during agent execution.",
        metadata: {
          code: errorCode,
        },
      };
    }
  }
}
export default AgentExecutionService;
