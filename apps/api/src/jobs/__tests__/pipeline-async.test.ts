import { vi, describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../../agents/core/agent.registry";
import { OrchestratorAgent } from "../../agents/research/orchestrator.agent";
import { ResearchAgent } from "../../agents/research/research.agent";
import { SourceAgent } from "../../agents/research/source.agent";
import { EvidenceAgent } from "../../agents/research/evidence.agent";
import { ClaimAgent } from "../../agents/research/claim.agent";
import { CriticAgent } from "../../agents/research/critic.agent";
import { SynthesisAgent } from "../../agents/research/synthesis.agent";
import { ResearchSessionExecutionService } from "../../services/research-session-execution.service";
import { ResearchExecutionService } from "../../services/research-execution.service";
import { JobService } from "../services/job.service";
import { researchTaskJobHandler } from "../workers/research-task.worker";
import { synthesisJobHandler } from "../workers/synthesis.worker";
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
        update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "task-123", ...args.data })),
        findUnique: vi.fn(),
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
      report: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "report-123", ...args.data })),
        update: vi.fn().mockImplementation((args) => Promise.resolve({ id: "report-123", ...args.data })),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    },
  };
});

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

// 3. Mock BullMQ Queue and AI Provider Structured Calls via vi.hoisted
const { mockQueueAdd, mockGenerateStructured } = vi.hoisted(() => {
  return {
    mockQueueAdd: vi.fn(),
    mockGenerateStructured: vi.fn(),
  };
});

vi.mock("bullmq", () => {
  return {
    Queue: vi.fn().mockImplementation(() => {
      return {
        add: mockQueueAdd,
      };
    }),
    Worker: vi.fn().mockImplementation(() => {
      return {
        on: vi.fn(),
        close: vi.fn(),
      };
    }),
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

describe("SCOUT Asynchronous Execution & Intelligent Synthesis Tests", () => {
  const mockUser = { id: "user-123", email: "dev@scout.local", name: "Development User" };
  const mockSession = {
    id: "a34efb9c-4b53-4b6e-8f2c-7b49466eef4c",
    title: "Battery Storage Analysis",
    query: "What is the round-trip efficiency of flow batteries vs lithium-ion?",
    status: "DRAFT",
    userId: "user-123",
    tasks: [],
    reports: [],
  };

  const mockTasksList = [
    {
      id: "task-123",
      title: "Lithium storage efficiency",
      description: "Collect efficiency stats",
      priority: "HIGH",
      status: "PENDING",
      researchSessionId: "a34efb9c-4b53-4b6e-8f2c-7b49466eef4c",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    AgentRegistry.clear();

    AgentRegistry.register(new OrchestratorAgent());
    AgentRegistry.register(new ResearchAgent());
    AgentRegistry.register(new SourceAgent());
    AgentRegistry.register(new EvidenceAgent());
    AgentRegistry.register(new ClaimAgent());
    AgentRegistry.register(new CriticAgent());
    AgentRegistry.register(new SynthesisAgent());

    // Prisma Mocks Defaults
    (prisma.user.upsert as any).mockResolvedValue(mockUser);
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.user.create as any).mockResolvedValue(mockUser);

    (prisma.researchTask.create as any).mockImplementation((args: any) => Promise.resolve({ id: "task-123", ...args.data }));
    (prisma.researchTask.update as any).mockImplementation((args: any) => Promise.resolve({ id: "task-123", ...args.data }));
    (prisma.agentRun.create as any).mockImplementation((args: any) => Promise.resolve({ id: "agent-run-123", ...args.data }));
    (prisma.agentRun.update as any).mockImplementation((args: any) => Promise.resolve({ id: "agent-run-123", ...args.data }));
    (prisma.source.create as any).mockImplementation((args: any) => Promise.resolve({ id: "source-123", ...args.data }));
    (prisma.evidence.create as any).mockImplementation((args: any) => Promise.resolve({ id: "evidence-123", ...args.data }));
    (prisma.claim.create as any).mockImplementation((args: any) => Promise.resolve({ id: "claim-123", ...args.data }));
    (prisma.claim.update as any).mockImplementation((args: any) => Promise.resolve({ id: "claim-123", ...args.data }));
    (prisma.claimEvidence.upsert as any).mockImplementation((args: any) => Promise.resolve({ id: "claim-evidence-123", ...args.create }));
    (prisma.report.create as any).mockImplementation((args: any) => Promise.resolve({ id: "report-123", ...args.data }));
    (prisma.report.update as any).mockImplementation((args: any) => Promise.resolve({ id: "report-123", ...args.data }));
  });

  // ===========================================================================
  // 1. QUEUEING & IDEMPOTENCY
  // ===========================================================================
  describe("Queue Scheduling & Idempotency", () => {
    it("should enqueue all planned tasks successfully when executing session", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        status: "DRAFT",
        tasks: mockTasksList,
      } as any);

      vi.mocked(prisma.researchTask.findMany).mockResolvedValue(mockTasksList as any);

      const result = await ResearchSessionExecutionService.startExecution(mockSession.id, mockUser.id);

      expect(result.researchSessionId).toBe(mockSession.id);
      expect(result.status).toBe("IN_PROGRESS");
      expect(result.queuedTasks).toBe(1);

      // Verify task job enqueued with correct arguments
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "RESEARCH_TASK",
        {
          type: "RESEARCH_TASK",
          researchSessionId: mockSession.id,
          researchTaskId: "task-123",
        },
        expect.objectContaining({
          jobId: "research-task:task-123",
        })
      );
    });

    it("should prevent double-triggering execution of already in-progress session", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        status: "IN_PROGRESS",
        tasks: mockTasksList,
      } as any);

      await expect(
        ResearchSessionExecutionService.startExecution(mockSession.id, mockUser.id)
      ).rejects.toThrowError(/already in progress/);
    });
  });

  // ===========================================================================
  // 2. WORKER JOB EXECUTIONS
  // ===========================================================================
  describe("ResearchTaskWorker", () => {
    it("should execute task steps via handler and update status successfully", async () => {
      vi.mocked(prisma.researchTask.findUnique).mockResolvedValue(mockTasksList[0] as any);
      vi.mocked(prisma.researchTask.findMany).mockResolvedValue([
        { ...mockTasksList[0], status: "COMPLETED" },
      ] as any);

      // Mock executeTask logic
      const spyExecute = vi.spyOn(ResearchExecutionService, "executeTask").mockResolvedValue(undefined);

      const mockJob = {
        id: "job-1",
        name: "RESEARCH_TASK",
        attemptsMade: 0,
        data: {
          type: "RESEARCH_TASK",
          researchSessionId: mockSession.id,
          researchTaskId: "task-123",
        },
      };

      await researchTaskJobHandler(mockJob);

      expect(spyExecute).toHaveBeenCalledWith(mockSession.id, "task-123");
      // Synthesis should be enqueued because task finished and completed >= min
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "SYNTHESIS",
        {
          type: "SYNTHESIS",
          researchSessionId: mockSession.id,
        },
        expect.objectContaining({
          jobId: `synthesis:${mockSession.id}`,
        })
      );
    });

    it("should skip processing if task is already COMPLETED", async () => {
      vi.mocked(prisma.researchTask.findUnique).mockResolvedValue({
        ...mockTasksList[0],
        status: "COMPLETED",
      } as any);

      const spyExecute = vi.spyOn(ResearchExecutionService, "executeTask");

      const mockJob = {
        id: "job-2",
        name: "RESEARCH_TASK",
        attemptsMade: 0,
        data: {
          type: "RESEARCH_TASK",
          researchSessionId: mockSession.id,
          researchTaskId: "task-123",
        },
      };

      await researchTaskJobHandler(mockJob);
      expect(spyExecute).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 3. PROGRESS METRICS
  // ===========================================================================
  describe("Progress Tracking Endpoint", () => {
    it("should calculate correct percentage, totals, and statuses from database state", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        status: "IN_PROGRESS",
        tasks: [
          { status: "COMPLETED" },
          { status: "FAILED" },
          { status: "PENDING" },
          { status: "IN_PROGRESS" },
        ],
      } as any);

      const app = await buildApp();
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/research-sessions/${mockSession.id}/progress`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.progress).toEqual({
        totalTasks: 4,
        pending: 1,
        inProgress: 1,
        completed: 1,
        failed: 1,
        percentage: 25,
      });
    });
  });

  // ===========================================================================
  // 4. REPORT SYNTHESIS WORKER
  // ===========================================================================
  describe("SynthesisWorker & Agent", () => {
    it("should run final SynthesisAgent, validate references, and persist Report COMPLETED", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue({
        ...mockSession,
        tasks: [{ status: "COMPLETED" }],
      } as any);

      vi.mocked(prisma.claim.count).mockResolvedValue(2); // Sufficient claims found
      vi.mocked(prisma.source.findMany).mockResolvedValue([
        { id: "source-123", title: "Study Source", url: "https://study.org" },
      ] as any);

      vi.mocked(prisma.claim.findMany).mockResolvedValue([
        {
          id: "claim-123",
          content: "Lithium-ion grid batteries maintain high round-trip efficiency",
          status: "SUPPORTED",
          evidence: [],
        },
      ] as any);

      // Mock LLM generation output matching structured schema
      mockGenerateStructured.mockResolvedValueOnce({
        title: "Battery Storage Report",
        executiveSummary: "Summary contents",
        researchQuestion: "Efficiency statistics",
        methodology: {
          overview: "Analyzed database sources",
          tasksCompleted: 1,
          tasksFailed: 0,
          sourcesAnalyzed: 1,
        },
        keyFindings: [
          {
            finding: "Lithium grid efficiency is high",
            confidence: 0.9,
            citations: ["source-123"],
          },
        ],
        detailedAnalysis: [
          {
            sectionTitle: "Main Metrics",
            content: "Detailed results data",
            citations: ["source-123"],
          },
        ],
        contradictions: [],
        limitations: [],
        conclusion: "Report conclusion text",
      });

      const mockJob = {
        id: "job-synthesis-1",
        name: "SYNTHESIS",
        data: {
          type: "SYNTHESIS",
          researchSessionId: mockSession.id,
        },
      };

      await synthesisJobHandler(mockJob);

      expect(prisma.report.create).toHaveBeenCalled();
      expect(prisma.researchSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSession.id },
          data: expect.objectContaining({ status: "COMPLETED" }),
        })
      );
    });

    it("should reject synthesis and mark session as FAILED if supported claims are insufficient", async () => {
      vi.mocked(prisma.researchSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.claim.count).mockResolvedValue(0); // Under minimum supported claims limit (1)

      const mockJob = {
        id: "job-synthesis-2",
        name: "SYNTHESIS",
        data: {
          type: "SYNTHESIS",
          researchSessionId: mockSession.id,
        },
      };

      await synthesisJobHandler(mockJob);

      // Synthesis should exit and mark session status to FAILED
      expect(prisma.researchSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSession.id },
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
      expect(prisma.report.create).not.toHaveBeenCalled();
    });
  });
});
