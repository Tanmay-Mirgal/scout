/**
 * Represents a single chat message sent to or received from the AI provider.
 */
export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Standardized request payload format passed to the AI provider abstraction.
 */
export interface ProviderRequest {
  messages: ProviderMessage[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, any>;
}

/**
 * Standardized usage statistics parsed from the AI provider response.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Standardized response payload returned by the AI provider abstraction.
 */
export interface ProviderResponse {
  content: string;
  model: string;
  provider: string;
  usage: TokenUsage;
  metadata?: Record<string, any>;
}
