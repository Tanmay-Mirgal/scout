import { z } from "zod";
import type { AIProvider } from "../core/ai-provider.interface";
import type { ProviderRequest, ProviderResponse } from "../core/provider.types";
import { CircuitBreaker } from "./circuit-breaker";

export interface ProviderChainEntry {
  provider: AIProvider;
  circuitBreaker: CircuitBreaker;
}

/**
 * Resilience Provider Manager wrapping multiple LLM providers into a prioritized
 * failover chain guarded by Circuit Breakers.
 */
export class ResilienceProviderManager implements AIProvider {
  readonly name = "Resilience Provider Manager";
  readonly providerType = "RESILIENCE_MANAGER";

  private chain: ProviderChainEntry[];

  constructor(providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new Error("ResilienceProviderManager requires at least one provider in fallback chain.");
    }

    this.chain = providers.map((p) => ({
      provider: p,
      circuitBreaker: new CircuitBreaker({ name: p.name, failureThreshold: 3, resetTimeoutMs: 10000 }),
    }));
  }

  public getChain(): ProviderChainEntry[] {
    return this.chain;
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const { provider, circuitBreaker } of this.chain) {
      if (!circuitBreaker.canExecute()) {
        console.warn(`[ResilienceManager] Circuit Breaker for ${provider.name} is OPEN. Skipping.`);
        errors.push({ provider: provider.name, error: "Circuit Breaker OPEN" });
        continue;
      }

      try {
        const response = await provider.generate(request);
        circuitBreaker.recordSuccess();
        return response;
      } catch (err: any) {
        circuitBreaker.recordFailure();
        const errorMessage = err.message || "Unknown provider error";
        console.error(`[ResilienceManager] Provider ${provider.name} failed: ${errorMessage}. Falling over...`);
        errors.push({ provider: provider.name, error: errorMessage });
      }
    }

    throw new Error(
      `All AI providers in resilience chain failed: ${errors.map((e) => `${e.provider} (${e.error})`).join("; ")}`
    );
  }

  async generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<T> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const { provider, circuitBreaker } of this.chain) {
      if (!circuitBreaker.canExecute()) {
        console.warn(`[ResilienceManager] Circuit Breaker for ${provider.name} is OPEN. Skipping.`);
        errors.push({ provider: provider.name, error: "Circuit Breaker OPEN" });
        continue;
      }

      try {
        const result = await provider.generateStructured(request, schema);
        circuitBreaker.recordSuccess();
        return result;
      } catch (err: any) {
        circuitBreaker.recordFailure();
        const errorMessage = err.message || "Unknown structured generation error";
        console.error(`[ResilienceManager] Structured provider ${provider.name} failed: ${errorMessage}. Falling over...`);
        errors.push({ provider: provider.name, error: errorMessage });
      }
    }

    throw new Error(
      `All AI providers in resilience chain failed structured generation: ${errors.map((e) => `${e.provider} (${e.error})`).join("; ")}`
    );
  }
}
