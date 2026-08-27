import type { TokenUsage } from "../../providers/core/provider.types";

/**
 * Standardized input context passed during agent execution.
 */
export interface AgentContext {
  researchSessionId: string;
  researchTaskId: string;
  query: string;
  context?: string;
  metadata?: Record<string, any>;
}

/**
 * Standardized result returned by agent execution attempts.
 */
export interface AgentResult {
  success: boolean;
  output: string;
  metadata?: Record<string, any>;
  usage?: TokenUsage;
  error?: string;
}
