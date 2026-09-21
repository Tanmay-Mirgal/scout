import { prisma } from "../lib/prisma";

export interface TokenUsageReport {
  sessionId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  maxTokens: number;
  percentageUsed: number;
  isExceeded: boolean;
}

export class TokenBudgetService {
  private static readonly DEFAULT_MAX_SESSION_TOKENS = 100000;
  private static readonly COST_PER_1K_PROMPT_TOKENS = 0.0005; // $0.0005 / 1k tokens
  private static readonly COST_PER_1K_COMPLETION_TOKENS = 0.0015; // $0.0015 / 1k tokens

  /**
   * Verifies if a session has headroom left within its allocated token budget.
   */
  public static async checkBudget(
    sessionId: string,
    maxTokens: number = this.DEFAULT_MAX_SESSION_TOKENS
  ): Promise<{ allowed: boolean; usedTokens: number; maxTokens: number }> {
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      select: { description: true },
    });

    const usage = await this.calculateSessionUsage(sessionId);
    const allowed = usage.totalTokens < maxTokens;

    return {
      allowed,
      usedTokens: usage.totalTokens,
      maxTokens,
    };
  }

  /**
   * Records LLM token consumption for a research session.
   */
  public static async recordUsage(
    sessionId: string,
    agentType: string,
    promptTokens: number,
    completionTokens: number
  ): Promise<void> {
    const totalTokens = promptTokens + completionTokens;
    const cost =
      (promptTokens / 1000) * this.COST_PER_1K_PROMPT_TOKENS +
      (completionTokens / 1000) * this.COST_PER_1K_COMPLETION_TOKENS;

    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    const existingMeta = (session.description || "").startsWith("LOG_USAGE:")
      ? JSON.parse(session.description!.replace("LOG_USAGE:", ""))
      : { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };

    const updatedMeta = {
      promptTokens: (existingMeta.promptTokens || 0) + promptTokens,
      completionTokens: (existingMeta.completionTokens || 0) + completionTokens,
      totalTokens: (existingMeta.totalTokens || 0) + totalTokens,
      costUsd: Number(((existingMeta.costUsd || 0) + cost).toFixed(6)),
      lastAgent: agentType,
      updatedAt: new Date().toISOString(),
    };

    // Store usage metrics in session description metadata payload
    await prisma.researchSession.update({
      where: { id: sessionId },
      data: {
        description: `LOG_USAGE:${JSON.stringify(updatedMeta)}`,
      },
    });
  }

  /**
   * Retrieves aggregated token usage metrics for a session.
   */
  public static async getSessionUsage(
    sessionId: string,
    userId: string,
    maxTokens: number = this.DEFAULT_MAX_SESSION_TOKENS
  ): Promise<TokenUsageReport | null> {
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      return null;
    }

    const usage = await this.calculateSessionUsage(sessionId);
    const percentageUsed = Math.min(100, Number(((usage.totalTokens / maxTokens) * 100).toFixed(1)));

    return {
      sessionId,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: usage.costUsd,
      maxTokens,
      percentageUsed,
      isExceeded: usage.totalTokens >= maxTokens,
    };
  }

  private static async calculateSessionUsage(sessionId: string): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
  }> {
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      select: { description: true },
    });

    if (session?.description && session.description.startsWith("LOG_USAGE:")) {
      try {
        const meta = JSON.parse(session.description.replace("LOG_USAGE:", ""));
        return {
          promptTokens: meta.promptTokens || 0,
          completionTokens: meta.completionTokens || 0,
          totalTokens: meta.totalTokens || 0,
          costUsd: meta.costUsd || 0,
        };
      } catch {
        // Fallback default if parsing fails
      }
    }

    return { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };
  }
}
