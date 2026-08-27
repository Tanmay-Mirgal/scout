import { z } from "zod";
import type { ProviderRequest, ProviderResponse } from "./provider.types";

/**
 * Common interface representing an AI provider.
 * All future LLM integrations must implement this contract.
 */
export interface AIProvider {
  name: string;
  providerType: string;

  /**
   * Generates a text completion or chat response based on a standardized request shape.
   */
  generate(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Generates a structured JSON object validated against a Zod schema.
   * Utilizes the provider's native JSON mode with retries and validation checks.
   */
  generateStructured<T>(request: ProviderRequest, schema: z.ZodType<T>): Promise<T>;
}
export default AIProvider;
