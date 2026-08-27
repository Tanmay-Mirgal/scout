import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

/**
 * Example agent used to test registry, routes, and context execution lifecycles.
 * Runs deterministically offline and does not call any AI provider APIs.
 */
export class EchoAgent extends BaseAgent {
  readonly name = "Echo Development Agent";
  readonly type = "EXAMPLE";
  readonly description = "Example agent returning input query content directly for verification.";

  async execute(context: AgentContext): Promise<AgentResult> {
    return {
      success: true,
      output: `Echo: ${context.query}`,
      metadata: {
        timestamp: new Date().toISOString(),
        researchSessionId: context.researchSessionId,
        researchTaskId: context.researchTaskId,
      },
    };
  }
}
export default EchoAgent;
