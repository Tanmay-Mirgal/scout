import { vi, describe, it, expect, beforeEach } from "vitest";
import { HITLWorkflowEngine } from "../hitl-workflow.service";
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

describe("HITLWorkflowEngine Unit & Integration Tests", () => {
  const sessionId = "a1b2c3d4-e5f6-7890-abcd-1234567890ab";

  beforeEach(() => {
    vi.clearAllMocks();
    HITLWorkflowEngine.clearStore();

    (prisma.user.findUnique as any).mockResolvedValue({
      id: "dev-user-123",
      email: "dev@scout.local",
      name: "Dev User",
    });

    (prisma.user.create as any).mockResolvedValue({
      id: "dev-user-123",
      email: "dev@scout.local",
      name: "Dev User",
    });

    (prisma.researchSession.findUnique as any).mockResolvedValue({
      id: sessionId,
      userId: "dev-user-123",
      title: "Clean Energy Transition",
    });
  });

  it("createCheckpoint creates a PENDING_APPROVAL breakpoint state snapshot", async () => {
    const chk = await HITLWorkflowEngine.createCheckpoint({
      sessionId,
      agentType: "SYNTHESIS",
      stepName: "Report Generation Checkpoint",
      stateSnapshot: { claimsVerified: 12, evidenceCount: 45 },
      inputParams: { targetWordCount: 2500, tone: "academic" },
    });

    expect(chk.checkpointId).toContain("chk-");
    expect(chk.status).toBe("PENDING_APPROVAL");
    expect(chk.agentType).toBe("SYNTHESIS");
    expect(chk.stateSnapshot.claimsVerified).toBe(12);
  });

  it("submitDecision with APPROVE resumes workflow with original inputs", async () => {
    const chk = await HITLWorkflowEngine.createCheckpoint({
      sessionId,
      agentType: "RESEARCH",
      stepName: "High-Cost Search API Call",
      stateSnapshot: { query: "Battery Storage" },
      inputParams: { maxDepth: 5 },
    });

    const result = await HITLWorkflowEngine.submitDecision({
      sessionId,
      userId: "dev-user-123",
      checkpointId: chk.checkpointId,
      action: "APPROVE",
      feedback: "Approved search execution.",
    });

    expect(result.status).toBe("RESUMED");
    expect(result.effectiveInput.maxDepth).toBe(5);
    expect(result.message).toContain("approved");
  });

  it("submitDecision with MODIFY_INPUT resumes workflow with overridden user parameters", async () => {
    const chk = await HITLWorkflowEngine.createCheckpoint({
      sessionId,
      agentType: "RESEARCH",
      stepName: "Web Scraper Target",
      stateSnapshot: { url: "http://example.com" },
      inputParams: { timeoutMs: 5000 },
    });

    const result = await HITLWorkflowEngine.submitDecision({
      sessionId,
      userId: "dev-user-123",
      checkpointId: chk.checkpointId,
      action: "MODIFY_INPUT",
      modifiedInput: { timeoutMs: 15000, userAgent: "CustomBot/2.0" },
      feedback: "Increase timeout and specify custom user agent.",
    });

    expect(result.status).toBe("RESUMED");
    expect(result.effectiveInput.timeoutMs).toBe(15000);
    expect(result.effectiveInput.userAgent).toBe("CustomBot/2.0");
  });

  it("submitDecision with REJECT cancels workflow execution", async () => {
    const chk = await HITLWorkflowEngine.createCheckpoint({
      sessionId,
      agentType: "CRITIC",
      stepName: "Verification Override",
      stateSnapshot: { contradiction: true },
      inputParams: { override: true },
    });

    const result = await HITLWorkflowEngine.submitDecision({
      sessionId,
      userId: "dev-user-123",
      checkpointId: chk.checkpointId,
      action: "REJECT",
      feedback: "Do not override contradiction.",
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.message).toContain("cancelled");
  });

  it("GET /api/v1/research-sessions/:id/hitl/checkpoints lists active breakpoints", async () => {
    const app = await buildApp();

    await HITLWorkflowEngine.createCheckpoint({
      sessionId,
      agentType: "ORCHESTRATOR",
      stepName: "Plan Approval",
      stateSnapshot: { tasks: 4 },
      inputParams: { parallel: true },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/research-sessions/${sessionId}/hitl/checkpoints`,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].agentType).toBe("ORCHESTRATOR");
  });

  it("POST /api/v1/research-sessions/:id/hitl/checkpoints/:checkpointId/decision handles HTTP decision submission", async () => {
    const app = await buildApp();

    const chk = await HITLWorkflowEngine.createCheckpoint({
      sessionId,
      agentType: "SYNTHESIS",
      stepName: "Final Publication Checkpoint",
      stateSnapshot: { ready: true },
      inputParams: { format: "pdf" },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/research-sessions/${sessionId}/hitl/checkpoints/${chk.checkpointId}/decision`,
      payload: {
        action: "APPROVE",
        feedback: "Looks good!",
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("RESUMED");
  });
});
