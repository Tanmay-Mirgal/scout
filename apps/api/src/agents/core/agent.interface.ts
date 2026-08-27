import type { AgentContext, AgentResult } from "./agent.types";

/**
 * Common contract implementing a specialized SCOUT Agent (Scout).
 */
export interface Agent {
  name: string;
  type: string;
  description: string;

  /**
   * Executes the agent workflow query within the provided context container.
   */
  execute(context: AgentContext): Promise<AgentResult>;
}
export default Agent;
