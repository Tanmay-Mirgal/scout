import { vi, describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../../app";

// Mock Prisma Client
vi.mock("../../../lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      researchSession: {
        findUnique: vi.fn(),
      },
      evidence: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    },
  };
});

// Mock Redis Client
vi.mock("../../../lib/redis", () => {
  return {
    redis: {
      status: "ready",
      ping: vi.fn().mockResolvedValue("PONG"),
      on: vi.fn(),
    },
  };
});

import { prisma } from "../../../lib/prisma";

describe("Evidence RAG Search API", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("POST /api/v1/research-sessions/:id/evidence/search", () => {
    const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
    const mockUser = { id: "user-123", email: "dev@scout.local" };
    const mockSession = {
      id: validSessionId,
      title: "Clean Energy Storage",
      userId: "user-123",
    };

    it("should return 404 if research session is not found", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/research-sessions/${validSessionId}/evidence/search`,
        payload: {
          query: "grid storage efficiency",
        },
      });

      expect(response.statusCode).toBe(404);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("should return HTTP 200 with hybrid search results when session exists", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);

      const mockEvidenceItems = [
        {
          id: "ev-100",
          content: "Lithium-ion batteries hold 85% of grid storage share as of 2024",
          summary: "Lithium-ion market share",
          location: "Section 2",
          relevanceScore: 0.95,
          confidenceScore: 0.9,
          sourceId: "src-100",
          researchSessionId: validSessionId,
          createdAt: new Date(),
        },
      ];

      (prisma.evidence.findMany as any).mockResolvedValue(mockEvidenceItems);

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/research-sessions/${validSessionId}/evidence/search`,
        payload: {
          query: "grid storage batteries",
          limit: 5,
          alpha: 0.5,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].id).toBe("ev-100");
      expect(json.data[0]).toHaveProperty("combinedScore");
      expect(json.data[0]).toHaveProperty("vectorScore");
      expect(json.data[0]).toHaveProperty("keywordScore");
    });

    it("should return HTTP 400 for empty search query validation error", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/research-sessions/${validSessionId}/evidence/search`,
        payload: {
          query: "   ",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
    });
  });
});
