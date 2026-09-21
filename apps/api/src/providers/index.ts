import type { AIProvider } from "./core/ai-provider.interface";
import { GroqProvider } from "./groq/groq.provider";
import { OpenAIProvider } from "./openai/openai.provider";
import { AnthropicProvider } from "./anthropic/anthropic.provider";
import { OllamaProvider } from "./ollama/ollama.provider";
import { ResilienceProviderManager } from "./resilience/resilience-provider.manager";

let providerInstance: AIProvider | null = null;

/**
 * Access factory to retrieve the configured AI provider.
 * Instantiates the ResilienceProviderManager singleton with a priority failover chain
 * (Groq -> OpenAI -> Anthropic -> Ollama).
 */
export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    const groq = new GroqProvider();
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();
    const ollama = new OllamaProvider();

    providerInstance = new ResilienceProviderManager([groq, openai, anthropic, ollama]);
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
export * from "./groq/groq.provider";
export * from "./openai/openai.provider";
export * from "./anthropic/anthropic.provider";
export * from "./ollama/ollama.provider";
export * from "./resilience/circuit-breaker";
export * from "./resilience/resilience-provider.manager";
export * from "./search";
