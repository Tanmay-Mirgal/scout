import { vi, describe, it, expect, beforeEach } from "vitest";
import { ContradictionEngineService } from "../contradiction-engine.service";
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
      },
      claim: {
        update: vi.fn(),
      },
      claimEvidence: {
        upsert: vi.fn(),
        findMany: vi.fn(),
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
      on: vi.fn(),
    },
  };
});

import { prisma } from "../../lib/prisma";

describe("ContradictionEngineService Unit Tests", () => {
  it("detects opposing trend statements as contradictions", async () => {
    const claim = "Solar adoption increased by 25% in Q3";
    const evidence = "Solar adoption decreased during Q3 due to supply constraints";

    const result = await ContradictionEngineService.evaluateContradiction(claim, evidence);
    expect(result.isContradiction).toBe(true);
    expect(result.strength).toBeGreaterThan(0.5);
    expect(result.explanation).toBeDefined();
  });

  it("does not flag non-conflicting statements as contradictions", async () => {
    const claim = "Solar power capacity expanded worldwide";
    const evidence = "Renewable energy investments reached new highs in 2024";

    const result = await ContradictionEngineService.evaluateContradiction(claim, evidence);
    expect(result.isContradiction).toBe(false);
  });
});

describe("Contradiction Engine API Routes", () => {
  let app: any;
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const mockUser = { id: "user-123", email: "dev@scout.local" };
  const mockSession = {
    id: validSessionId,
    title: "Energy Storage Trends",
    userId: "user-123",
    claims: [
      { id: "c-1", content: "Battery efficiency increased in 2024" },
    ],
    evidence: [
      { id: "e-1", content: "Battery efficiency decreased sharply in 2024" },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it("POST /api/v1/research-sessions/:id/contradictions/analyze runs analysis and returns report", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);
    (prisma.claimEvidence.upsert as any).mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/research-sessions/${validSessionId}/contradictions/analyze`,
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.payload);
    expect(json.success).toBe(true);
    expect(json.data.sessionId).toBe(validSessionId);
    expect(json.data.totalClaims).toBe(1);
    expect(json.data.contradictionCount).toBeGreaterThan(0);
    expect(json.data.overallDisagreementScore).toBeGreaterThan(0);
  });

  it("GET /api/v1/research-sessions/:id/contradictions lists detected contradictory pairs", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);
    (prisma.claimEvidence.findMany as any).mockResolvedValue([
      {
        claimId: "c-1",
        evidenceId: "e-1",
        relationship: "CONTRADICTS",
        strength: 0.85,
        notes: "Opposing trend indicators detected",
        claim: { content: "Battery efficiency increased" },
        evidence: { content: "Battery efficiency decreased" },
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/research-sessions/${validSessionId}/contradictions`,
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.payload);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0].claimId).toBe("c-1");
    expect(json.data[0].relationship || "CONTRADICTS").toBe("CONTRADICTS");
  });
});
