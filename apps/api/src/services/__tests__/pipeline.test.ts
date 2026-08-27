import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentRegistry } from "../../agents/core/agent.registry";
import { OrchestratorAgent } from "../../agents/research/orchestrator.agent";
import { ResearchAgent } from "../../agents/research/research.agent";
import { SourceAgent } from "../../agents/research/source.agent";
import { EvidenceAgent } from "../../agents/research/evidence.agent";
import { ClaimAgent } from "../../agents/research/claim.agent";
import { CriticAgent } from "../../agents/research/critic.agent";
import { ResearchPlanningService } from "../research-planning.service";
import { ResearchExecutionService } from "../research-execution.service";
import { buildApp } from "../../app";

// 1. Mock Prisma Client
vi.mock("../../lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-123", email: "dev@scout.local" }),
        create: vi.fn().mockResolvedValue({ id: "user-123", email: "dev@scout.local" }),
        upsert: vi.fn().mockResolvedValue({ id: "user-123", email: "dev@scout.local" }),
      },
      researchSession: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "session-123", ...args.data })),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      researchTask: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "task-123", ...args.data })),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "task-123", ...args.data })),
        count: vi.fn(),
      },
      agentRun: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "agent-run-123", ...args.data })),
        update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "agent-run-123", ...args.data })),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      source: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "source-123", ...args.data })),
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      evidence: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "evidence-123", ...args.data })),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      claim: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "claim-123", ...args.data })),
        count: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "claim-123", ...args.data })),
      },
      claimEvidence: {
        upsert: vi.fn().mockImplementation((args) => Promise.resolve({ id: "claim-evidence-123", ...args.create })),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    },
  };
});

// Import mocked prisma
import { prisma } from "../../lib/prisma";

// 2. Mock Redis Client to prevent network connections
vi.mock("../../lib/redis", () => {
  return {
    redis: {
      status: "ready",
      ping: vi.fn().mockResolvedValue("PONG"),
      on: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
    },
  };
});

// 3. Hoist mock functions to ensure initialization order is correct
const { mockGenerateStructured, mockSearch } = vi.hoisted(() => {
  return {
    mockGenerateStructured: vi.fn(),
    mockSearch: vi.fn(),
  };
});

vi.mock("../../providers/groq/groq.provider", () => {
  return {
    GroqProvider: vi.fn().mockImplementation(() => {
      return {
        name: "Groq AI Provider",
        providerType: "GROQ",
        generate: vi.fn(),
        generateStructured: mockGenerateStructured,
      };
    }),
  };
});

// 4. Mock SearchProvider
vi.mock("../../providers/search/tavily-search.provider", () => {
  return {
    TavilySearchProvider: vi.fn().mockImplementation(() => {
      return {
        search: mockSearch,
      };
    }),
  };
});

// 5. Mock BullMQ to prevent actual Redis connections
vi.mock("bullmq", () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ id: "job-mock" }),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn(),
    })),
  };
});

// 6. Mock providers index to prevent singleton caching issues in tests
vi.mock("../../providers", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    getAIProvider: vi.fn(() => ({
      name: "Mock Groq Provider",
      providerType: "GROQ",
      generate: vi.fn(),
      generateStructured: mockGenerateStructured,
    })),
    resetAIProvider: vi.fn(),
  };
});
vi.mock("../../lib/content-fetcher", () => {
  return {
    ContentFetcher: {
      fetchContent: vi.fn().mockResolvedValue("Mock scraped raw text from page body."),
    },
    default: {
      fetchContent: vi.fn().mockResolvedValue("Mock scraped raw text from page body."),
    },
  };
});

describe("SCOUT Research Intelligence Pipeline Service Tests", () => {
  const mockUser = { id: "user-123", email: "dev@scout.local", name: "Development User" };
  const mockSession = {
    id: "a34efb9c-4b53-4b6e-8f2c-7b49466eef4c", // Valid UUID to satisfy Fastify params validations
    title: "Battery Storage Analysis",
    query: "What is the round-trip efficiency of flow batteries vs lithium-ion?",
    status: "DRAFT",
    userId: "user-123",
    tasks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    AgentRegistry.clear();

    // Register active agents for execution service lookup
    AgentRegistry.register(new OrchestratorAgent());
    AgentRegistry.register(new ResearchAgent());
    AgentRegistry.register(new SourceAgent());
    AgentRegistry.register(new EvidenceAgent());
    AgentRegistry.register(new ClaimAgent());
    AgentRegistry.register(new CriticAgent());

    // Setup default Prisma mock returns
    (prisma.user.upsert as any).mockResolvedValue(mockUser);
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.user.create as any).mockResolvedValue(mockUser);

    // Setup write mock implementations using 'any' casting to bypass complex tsc Prisma types
    (prisma.researchTask.create as any).mockImplementation((args: any) => Promise.resolve({ id: "task-123", ...args.data }));
    (prisma.researchTask.update as any).mockImplementation((args: any) => Promise.resolve({ id: "task-123", ...args.data }));
    (prisma.researchTask.findUnique as any).mockResolvedValue(null);
    (prisma.agentRun.create as any).mockImplementation((args: any) => Promise.resolve({ id: "agent-run-123", ...args.data }));
    (prisma.agentRun.update as any).mockImplementation((args: any) => Promise.resolve({ id: "agent-run-123", ...args.data }));
    (prisma.source.create as any).mockImplementation((args: any) => Promise.resolve({ id: "source-123", ...args.data }));
    (prisma.evidence.create as any).mockImplementation((args: any) => Promise.resolve({ id: "evidence-123", ...args.data }));
    (prisma.claim.create as any).mockImplementation((args: any) => Promise.resolve({ id: "claim-123", ...args.data }));
    (prisma.claim.update as any).mockImplementation((args: any) => Promise.resolve({ id: "claim-123", ...args.data }));
    (prisma.claimEvidence.upsert as any).mockImplementation((args: any) => Promise.resolve({ id: "claim-evidence-123", ...args.create }));
  });

  // ===========================================================================
  // 1. PLANNING TESTS
  // ===========================================================================
  describe("ResearchPlanningService", () => {
    it("should generate research plan and store pending tasks successfully", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        tasks: [],
      } as any);

      // Mock orchestrator structured return
      mockGenerateStructured.mockResolvedValueOnce({
        objective: "Analyze round-trip efficiency comparisons",
        tasks: [
          {
            title: "Assess lithium-ion metrics",
            description: "Search for lithium battery round-trip grid statistics",
            priority: "HIGH",
            expectedOutput: "Efficiency percentage values",
          },
        ],
      });

      // Mock task creation
      const mockTask = {
        id: "task-123",
        title: "Assess lithium-ion metrics",
        description: "Search for lithium battery round-trip grid statistics",
        priority: "HIGH",
        status: "PENDING",
        researchSessionId: mockSession.id,
      };
      vi.mocked(prisma.researchTask.create).mockResolvedValue(mockTask as any);
      vi.mocked(prisma.researchSession.update).mockResolvedValue({
        ...mockSession,
        status: "QUEUED",
      } as any);

      const planResult = await ResearchPlanningService.planSession(mockSession.id, mockUser.id);

      expect(planResult.researchSessionId).toBe(mockSession.id);
      expect(planResult.status).toBe("QUEUED");
      expect(planResult.tasks).toHaveLength(1);
      expect(planResult.tasks[0].status).toBe("PENDING");
      expect(planResult.tasks[0].priority).toBe("HIGH");

      expect(prisma.researchTask.create).toHaveBeenCalled();
    });

    it("should prevent duplicate planning of the same session", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        tasks: [{ id: "existing-task-id" }],
      } as any);

      await expect(
        ResearchPlanningService.planSession(mockSession.id, mockUser.id)
      ).rejects.toThrowError(/already been planned/);
    });
  });

  // ===========================================================================
  // 2. PIPELINE EXECUTION TESTS
  // ===========================================================================
  describe("ResearchExecutionService", () => {
    const mockTasksList = [
      {
        id: "task-123",
        title: "Lithium storage efficiency",
        description: "Collect efficiency stats of lithium-ion systems",
        priority: "HIGH",
        status: "PENDING",
        researchSessionId: "a34efb9c-4b53-4b6e-8f2c-7b49466eef4c",
      },
    ];

    it("should execute the complete sequential research pipeline successfully", async () => {
      // Setup session fetch with tasks
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        status: "QUEUED",
        tasks: mockTasksList,
      } as any);

      vi.mocked(prisma.researchTask.findMany).mockResolvedValue(mockTasksList as any);
      vi.mocked(prisma.researchTask.findUnique).mockResolvedValue(mockTasksList[0] as any);

      // Setup mock pipeline agent returns
      // 1. ResearchAgent search queries generation:
      mockGenerateStructured.mockResolvedValueOnce({
        queries: ["lithium battery round trip efficiency grid"],
      });

      // 2. SearchProvider search response:
      mockSearch.mockResolvedValueOnce({
        results: [
          {
            title: "Grid Battery Studies 2024",
            url: "https://studies-storage.org/battery-report",
            snippet: "Lithium-ion efficiency is around 85% to 90% in utility grid projects.",
            rawContent: "Detailed page body indicating lithium batteries achieve 85% to 90% round trip efficiency.",
            publishedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });

      // 3. SourceAgent source credibility evaluation:
      mockGenerateStructured.mockResolvedValueOnce({
        relevant: true,
        credibilityScore: 0.90,
        relevanceScore: 0.95,
        reasoning: "Published by storage organization study registry.",
        sourceType: "RESEARCH_PAPER",
      });

      // 4. EvidenceAgent evidence extraction:
      mockGenerateStructured.mockResolvedValueOnce({
        evidence: [
          {
            content: "Lithium-ion efficiency is around 85% to 90% in utility grid projects.",
            summary: "Lithium-ion efficiency",
            location: "Grid storage report section",
            relevanceScore: 0.95,
            confidenceScore: 0.90,
          },
        ],
      });

      // 5. ClaimAgent claim synthesis:
      mockGenerateStructured.mockResolvedValueOnce({
        claims: [
          {
            content: "Lithium-ion grid batteries maintain high round-trip efficiency",
            reasoning: "Directly verified by utility grid statistics in storage studies.",
          },
        ],
      });

      // 6. CriticAgent claim verification evaluation:
      mockGenerateStructured.mockResolvedValueOnce({
        status: "SUPPORTED",
        confidenceScore: 0.90,
        reasoning: "Directly corroborated by extracted grid battery studies.",
        mappings: [
          {
            evidenceIndex: 0,
            relationship: "SUPPORTS",
            strength: 0.95,
            reasoning: "The statistics support the efficiency assertion.",
          },
        ],
      });

      // Setup database mock insertions
      vi.mocked(prisma.source.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.source.create).mockResolvedValue({ id: "source-123" } as any);
      vi.mocked(prisma.evidence.create).mockResolvedValue({ id: "evidence-123" } as any);
      vi.mocked(prisma.claim.create).mockResolvedValue({ id: "claim-123" } as any);
      
      vi.mocked(prisma.claim.findMany).mockResolvedValue([
        { id: "claim-123", content: "Lithium-ion grid batteries maintain high round-trip efficiency", status: "UNVERIFIED" },
      ] as any);
      vi.mocked(prisma.evidence.findMany).mockResolvedValue([
        { id: "evidence-123", content: "Lithium-ion efficiency is around 85% to 90% in utility grid projects.", summary: "Lithium-ion efficiency" },
      ] as any);

      // Run execution pipeline
      const stats = await ResearchExecutionService.executeSession(mockSession.id, mockUser.id);

      expect(stats.tasks.total).toBe(1);
      expect(stats.tasks.completed).toBe(1);
      expect(stats.tasks.failed).toBe(0);
      expect(prisma.source.create).toHaveBeenCalled();
      expect(prisma.evidence.create).toHaveBeenCalled();
      expect(prisma.claim.create).toHaveBeenCalled();
      expect(prisma.claimEvidence.upsert).toHaveBeenCalled();
    });

    it("should prevent concurrent execution of the same research session", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        status: "IN_PROGRESS",
        tasks: mockTasksList,
      } as any);

      await expect(
        ResearchExecutionService.executeSession(mockSession.id, mockUser.id)
      ).rejects.toThrowError(/execution is already in progress/);
    });
  });

  // ===========================================================================
  // 3. API ENDPOINT TESTS
  // ===========================================================================
  describe("API Endpoint Registrations", () => {
    it("should execute session plan via POST plan endpoint", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        tasks: [],
      } as any);

      mockGenerateStructured.mockResolvedValueOnce({
        objective: "Verify route planning",
        tasks: [
          {
            title: "Task Route Test",
            description: "Test description",
            priority: "LOW",
            expectedOutput: "JSON output",
          },
        ],
      });

      const app = await buildApp();
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/research-sessions/${mockSession.id}/plan`,
      });

      expect(response.statusCode).toBe(200);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(true);
    });
  });
});
