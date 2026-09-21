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

describe("Real-time SSE Stream API", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("GET /api/v1/research-sessions/:id/stream", () => {
    const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
    const mockUser = { id: "user-123", email: "dev@scout.local" };
    const mockSession = {
      id: validSessionId,
      title: "Clean Energy Storage",
      status: "IN_PROGRESS",
      userId: "user-123",
    };

    it("should return HTTP 404 if research session does not exist", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/research-sessions/${validSessionId}/stream`,
      });

      expect(response.statusCode).toBe(404);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("should set text/event-stream headers and send initial CONNECTED handshake for valid session", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/research-sessions/${validSessionId}/stream`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      expect(response.headers["cache-control"]).toContain("no-cache");
      expect(response.payload).toContain("event: CONNECTED");
      expect(response.payload).toContain(validSessionId);
    });
  });
});
