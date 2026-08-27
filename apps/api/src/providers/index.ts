import type { AIProvider } from "./core/ai-provider.interface";
import { GroqProvider } from "./groq/groq.provider";

let providerInstance: AIProvider | null = null;

/**
 * Access factory to retrieve the configured AI provider.
 * Instantiates the GroqProvider singleton. Design allows future providers
 * to register here without agent-level changes.
 */
export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = new GroqProvider();
  }
  return providerInstance;
}

/**
 * Resets the cached AI provider instance (useful in testing).
 */
export function resetAIProvider(): void {
  providerInstance = null;
}

export * from "./core/ai-provider.interface";
export * from "./core/provider.types";
export * from "./search";
