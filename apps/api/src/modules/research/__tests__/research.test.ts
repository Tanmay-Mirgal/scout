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
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

// Mock Redis Client to avoid network connections during testing
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

describe("Research Session CRUD API", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  // ===========================================================================
  // 1. CREATE SESSION TESTS
  // ===========================================================================
  describe("POST /api/v1/research-sessions", () => {
    it("should create a research session successfully", async () => {
      const mockUser = { id: "user-123", email: "dev@scout.local" };
      const mockSession = {
        id: "session-123",
        title: "Renewable storage comparison",
        query: "Compare different renewable energy storage technologies.",
        description: "Focusing on thermal vs chemical battery models.",
        status: "DRAFT",
        userId: "user-123",
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.create as any).mockResolvedValue(mockSession);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/research-sessions",
        payload: {
          title: "Renewable storage comparison",
          query: "Compare different renewable energy storage technologies.",
          description: "Focusing on thermal vs chemical battery models.",
        },
      });

      expect(response.statusCode).toBe(201);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(true);
      expect(res.data.id).toBe("session-123");
      expect(res.data.status).toBe("DRAFT");
    });

    it("should reject invalid create requests (Zod validation error)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/research-sessions",
        payload: {
          title: "Hi", // too short (min 3)
          query: "Short", // too short (min 10)
        },
      });

      expect(response.statusCode).toBe(400);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(false);
      expect(res.error.code).toBe("VALIDATION_ERROR");
      expect(res.error.details.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 2. LIST SESSIONS TESTS
  // ===========================================================================
  describe("GET /api/v1/research-sessions", () => {
    it("should list sessions with pagination details", async () => {
      const mockUser = { id: "user-123", email: "dev@scout.local" };
      const mockSessions = [
        { id: "s-1", title: "Topic 1", query: "Query 1", status: "DRAFT", userId: "user-123" },
        { id: "s-2", title: "Topic 2", query: "Query 2", status: "COMPLETED", userId: "user-123" },
      ];

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.count as any).mockResolvedValue(2);
      (prisma.researchSession.findMany as any).mockResolvedValue(mockSessions);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/research-sessions?page=1&limit=5",
      });

      expect(response.statusCode).toBe(200);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(true);
      expect(res.data.length).toBe(2);
      expect(res.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 2,
        totalPages: 1,
      });
    });
  });

  // ===========================================================================
  // 3. GET SINGLE SESSION TESTS
  // ===========================================================================
  describe("GET /api/v1/research-sessions/:id", () => {
    it("should retrieve a single session successfully", async () => {
      const mockUser = { id: "user-123", email: "dev@scout.local" };
      const mockSession = {
        id: "a34efb9c-4b53-4b6e-8f2c-7b49466eef4c",
        title: "Valid title",
        query: "Valid research query long enough",
        status: "DRAFT",
        userId: "user-123",
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(mockSession);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/research-sessions/${mockSession.id}`,
      });

      expect(response.statusCode).toBe(200);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(true);
      expect(res.data.id).toBe(mockSession.id);
    });

    it("should return 404 for a non-existent session UUID", async () => {
      const mockUser = { id: "user-123", email: "dev@scout.local" };
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/research-sessions/b56efb9c-4b53-4b6e-8f2c-7b49466eef4c",
      });

      expect(response.statusCode).toBe(404);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(false);
      expect(res.error.code).toBe("NOT_FOUND");
    });

    it("should return 400 for a malformed non-UUID id param", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/research-sessions/not-a-uuid-string",
      });

      expect(response.statusCode).toBe(400);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(false);
      expect(res.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ===========================================================================
  // 4. UPDATE SESSION TESTS
  // ===========================================================================
  describe("PATCH /api/v1/research-sessions/:id", () => {
    it("should update a session details successfully", async () => {
      const mockUser = { id: "user-123", email: "dev@scout.local" };
      const sessionId = "a34efb9c-4b53-4b6e-8f2c-7b49466eef4c";
      const existingSession = { id: sessionId, userId: "user-123", status: "DRAFT" };
      const updatedSession = { ...existingSession, title: "New title", status: "IN_PROGRESS" };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(existingSession);
      (prisma.researchSession.update as any).mockResolvedValue(updatedSession);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/research-sessions/${sessionId}`,
        payload: {
          title: "New title",
          status: "IN_PROGRESS",
        },
      });

      expect(response.statusCode).toBe(200);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(true);
      expect(res.data.title).toBe("New title");
      expect(res.data.status).toBe("IN_PROGRESS");
    });
  });

  // ===========================================================================
  // 5. DELETE SESSION TESTS
  // ===========================================================================
  describe("DELETE /api/v1/research-sessions/:id", () => {
    it("should delete a session successfully", async () => {
      const mockUser = { id: "user-123", email: "dev@scout.local" };
      const sessionId = "a34efb9c-4b53-4b6e-8f2c-7b49466eef4c";
      const existingSession = { id: sessionId, userId: "user-123" };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.researchSession.findUnique as any).mockResolvedValue(existingSession);
      (prisma.researchSession.delete as any).mockResolvedValue(existingSession);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/research-sessions/${sessionId}`,
      });

      expect(response.statusCode).toBe(200);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(true);
      expect(res.message).toContain("deleted successfully");
    });
  });
});
