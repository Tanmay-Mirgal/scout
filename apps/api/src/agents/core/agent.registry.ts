import type { Agent } from "./agent.interface";

/**
 * Registry to register, list, and retrieve SCOUT agents.
 * Central discovery point to avoid hardcoding workflow structures.
 */
export class AgentRegistry {
  private static agents = new Map<string, Agent>();

  /**
   * Registers a new agent instance.
   */
  static register(agent: Agent): void {
    const key = agent.type.toUpperCase();
    this.agents.set(key, agent);
  }

  /**
   * Retrieves an agent by its designated type identifier.
   * Throws a structured error if missing.
   */
  static get(type: string): Agent {
    const key = type.toUpperCase();
    const agent = this.agents.get(key);
    
    if (!agent) {
      const error = new Error(`Agent type '${type}' was not found in the Agent Registry.`);
      (error as any).code = "AGENT_NOT_FOUND";
      throw error;
    }
    
    return agent;
  }

  /**
   * Lists all registered agents.
   */
  static list(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Clears all registered agents (useful in testing).
   */
  static clear(): void {
    this.agents.clear();
  }
}
export default AgentRegistry;
