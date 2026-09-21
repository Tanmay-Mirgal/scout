import { vi, describe, it, expect, beforeEach } from "vitest";
import { TokenBudgetService } from "../token-budget.service";
import { buildApp } from "../../app";

// Mock Prisma Client
vi.mock("../../lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      researchSession: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

// Mock Redis Client
vi.mock("../../lib/redis", () => {
  return {
    redis: {
      status: "ready",
      ping: vi.fn().mockResolvedValue("PONG"),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(true),
      on: vi.fn(),
    },
  };
});

import { prisma } from "../../lib/prisma";

describe("TokenBudgetService Unit Tests", () => {
  const sessionId = "session-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checkBudget returns allowed: true when token count is below maximum", async () => {
    (prisma.researchSession.findUnique as any).mockResolvedValue({
      description: 'LOG_USAGE:{"promptTokens":1000,"completionTokens":500,"totalTokens":1500,"costUsd":0.00125}',
    });

    const result = await TokenBudgetService.checkBudget(sessionId, 100000);
    expect(result.allowed).toBe(true);
    expect(result.usedTokens).toBe(1500);
    expect(result.maxTokens).toBe(100000);
  });

  it("checkBudget returns allowed: false when session exceeds maximum token budget", async () => {
    (prisma.researchSession.findUnique as any).mockResolvedValue({
      description: 'LOG_USAGE:{"promptTokens":80000,"completionTokens":30000,"totalTokens":110000,"costUsd":0.085}',
    });

    const result = await TokenBudgetService.checkBudget(sessionId, 100000);
    expect(result.allowed).toBe(false);
    expect(result.usedTokens).toBe(110000);
  });

  it("recordUsage updates session description metadata with accumulated usage", async () => {
    (prisma.researchSession.findUnique as any).mockResolvedValue({
      id: sessionId,
      description: 'LOG_USAGE:{"promptTokens":500,"completionTokens":500,"totalTokens":1000,"costUsd":0.001}',
    });

    await TokenBudgetService.recordUsage(sessionId, "RESEARCH", 500, 500);

    expect(prisma.researchSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionId },
        data: expect.objectContaining({
          description: expect.stringContaining("LOG_USAGE:"),
        }),
      })
    );
  });
});

describe("Token Budget Usage API Route", () => {
  let app: any;
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const mockUser = { id: "user-123", email: "dev@scout.local" };
  const mockSession = {
    id: validSessionId,
    title: "Energy Grid Efficiency",
    userId: "user-123",
    description: 'LOG_USAGE:{"promptTokens":4000,"completionTokens":2000,"totalTokens":6000,"costUsd":0.005}',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("GET /api/v1/research-sessions/:id/usage returns token metrics", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/research-sessions/${validSessionId}/usage`,
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.payload);
    expect(json.success).toBe(true);
    expect(json.data.sessionId).toBe(validSessionId);
    expect(json.data.totalTokens).toBe(6000);
    expect(json.data.percentageUsed).toBe(6.0);
    expect(json.data.isExceeded).toBe(false);
  });
});
