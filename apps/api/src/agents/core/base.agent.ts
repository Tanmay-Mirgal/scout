import type { Agent } from "./agent.interface";
import type { AgentContext, AgentResult } from "./agent.types";
import { getAIProvider, type AIProvider } from "../../providers";

/**
 * Reusable abstract base class for SCOUT agents.
 * Provides structured access to the AI Provider without directly exposing SDK details.
 */
export abstract class BaseAgent implements Agent {
  abstract name: string;
  abstract type: string;
  abstract description: string;

  /**
   * Helper to retrieve the active, configured AI Provider wrapper.
   */
  protected getProvider(): AIProvider {
    return getAIProvider();
  }

  /**
   * Concrete execution hook implemented by individual scouts.
   */
  abstract execute(context: AgentContext): Promise<AgentResult>;
}
export default BaseAgent;
