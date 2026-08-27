import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

/**
 * Live test agent executing queries against the active Groq AI provider.
 * Used to verify live key configs and model outputs.
 */
export class GroqTestAgent extends BaseAgent {
  readonly name = "Groq Test Agent";
  readonly type = "GROQ_TEST";
  readonly description = "Test agent dispatching execution queries to the active AI provider.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();

    // Call the provider abstraction (not the SDK)
    const response = await provider.generate({
      messages: [
        {
          role: "user",
          content: context.query,
        },
      ],
      systemPrompt: "You are a SCOUT test agent. Respond in 2 sentences or less.",
      temperature: 0.7,
    });

    return {
      success: true,
      output: response.content,
      usage: response.usage,
      metadata: {
        model: response.model,
        provider: response.provider,
        ...response.metadata,
      },
    };
  }
}
export default GroqTestAgent;
