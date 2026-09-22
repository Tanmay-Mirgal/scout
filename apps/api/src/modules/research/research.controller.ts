import type { FastifyReply, FastifyRequest } from "fastify";
import { ResearchService } from "./research.service";
import {
  createSessionSchema,
  updateSessionSchema,
  sessionParamsSchema,
  sessionQuerySchema,
  tasksQuerySchema,
  sourcesQuerySchema,
  evidenceQuerySchema,
  claimsQuerySchema,
  searchEvidenceSchema,
  exportReportQuerySchema,
  scrapeSourceSchema,
  generateChartSchema,
  checkpointParamsSchema,
  submitHitlDecisionSchema,
} from "./research.schema";
import { ResearchPlanningService } from "../../services/research-planning.service";
import { ResearchExecutionService } from "../../services/research-execution.service";
import { ResearchSessionExecutionService } from "../../services/research-session-execution.service";
import { AgentStreamService, AgentStreamEvent } from "../../services/agent-stream.service";
import { prisma } from "../../lib/prisma";

/**
 * Controller layer translating HTTP requests to Service calls and formatting API responses.
 * Enforces Zod validation at runtime to trigger standard formatting error handlers.
 */
export class ResearchController {
  /**
   * Handles creating a new research session.
   */
  static async createSession(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    // Validate request body
    const validatedBody = createSessionSchema.parse(request.body);
    const session = await ResearchService.createSession(validatedBody, devUser.id);

    return reply.status(201).send({
      success: true,
      data: session,
    });
  }

  /**
   * Handles listing all research sessions with pagination and filters.
   */
  static async listSessions(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    // Validate query parameters
    const validatedQuery = sessionQuerySchema.parse(request.query);
    const { items, pagination } = await ResearchService.listSessions(devUser.id, validatedQuery);

    return reply.status(200).send({
      success: true,
      data: items,
      pagination,
    });
  }

  /**
   * Handles retrieving a single research session by ID.
   */
  static async getSessionById(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    // Validate request params
    const validatedParams = sessionParamsSchema.parse(request.params);
    const session = await ResearchService.getSessionById(validatedParams.id, devUser.id);

    if (!session) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: session,
    });
  }

  /**
   * Handles updating fields of a research session.
   */
  static async updateSession(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    // Validate request params and body
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedBody = updateSessionSchema.parse(request.body);
    const session = await ResearchService.updateSession(validatedParams.id, devUser.id, validatedBody);

    if (!session) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: session,
    });
  }

  /**
   * Handles deleting a research session.
   */
  static async deleteSession(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    // Validate request params
    const validatedParams = sessionParamsSchema.parse(request.params);
    const success = await ResearchService.deleteSession(validatedParams.id, devUser.id);

    if (!success) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Research session deleted successfully",
    });
  }

  /**
   * Handles task planning for a research session.
   */
  static async planSession(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const plan = await ResearchPlanningService.planSession(validatedParams.id, devUser.id);

    return reply.status(200).send({
      success: true,
      data: plan,
    });
  }

  /**
   * Handles executing the modular research pipeline asynchronously.
   */
  static async executeSession(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    try {
      const data = await ResearchSessionExecutionService.startExecution(validatedParams.id, devUser.id);
      return reply.status(200).send({ success: true, data });
    } catch (err: any) {
      if (err.code === "RESEARCH_SESSION_NOT_FOUND") {
        return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: err.message } });
      }
      if (err.code === "UNAUTHORIZED") {
        return reply.status(403).send({ success: false, error: { code: "FORBIDDEN", message: err.message } });
      }
      if (err.code === "CONFLICT") {
        return reply.status(409).send({ success: false, error: { code: "CONFLICT", message: err.message } });
      }
      if (err.code === "RESEARCH_PLAN_NOT_FOUND") {
        return reply.status(400).send({ success: false, error: { code: "BAD_REQUEST", message: err.message } });
      }
      // Re-throw for global error handler
      throw err;
    }
  }

  /**
   * Retrieves persistent progress metrics for a research session.
   */
  static async getSessionProgress(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const session = await prisma.researchSession.findUnique({
      where: { id: validatedParams.id },
      include: { tasks: true },
    });

    if (!session) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    if (session.userId !== devUser.id) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Unauthorized access to research session",
        },
      });
    }

    const tasks = session.tasks;
    const totalTasks = tasks.length;
    const pending = tasks.filter((t) => t.status === "PENDING").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const failed = tasks.filter((t) => t.status === "FAILED").length;

    const percentage = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    return reply.status(200).send({
      success: true,
      data: {
        researchSessionId: session.id,
        status: session.status,
        progress: {
          totalTasks,
          pending,
          inProgress,
          completed,
          failed,
          percentage,
        },
      },
    });
  }

  /**
   * Retrieves the final report of a research session.
   */
  static async getSessionReport(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const session = await prisma.researchSession.findUnique({
      where: { id: validatedParams.id },
      include: { reports: true },
    });

    if (!session) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    if (session.userId !== devUser.id) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Unauthorized access to research session",
        },
      });
    }

    const report = session.reports.find((r) => r.status === "COMPLETED");

    return reply.status(200).send({
      success: true,
      data: {
        researchSessionId: session.id,
        status: session.status,
        report: report
          ? {
              id: report.id,
              title: report.title,
              content: JSON.parse(report.content),
            }
          : null,
      },
    });
  }

  /**
   * Lists tasks for a research session.
   */
  static async getSessionTasks(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedQuery = tasksQuerySchema.parse(request.query);

    const result = await ResearchService.getSessionTasks(validatedParams.id, devUser.id, validatedQuery);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }

  /**
   * Lists sources for a research session.
   */
  static async getSessionSources(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedQuery = sourcesQuerySchema.parse(request.query);

    const result = await ResearchService.getSessionSources(validatedParams.id, devUser.id, validatedQuery);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }

  /**
   * Lists evidence records for a research session.
   */
  static async getSessionEvidence(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedQuery = evidenceQuerySchema.parse(request.query);

    const result = await ResearchService.getSessionEvidence(validatedParams.id, devUser.id, validatedQuery);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }

  /**
   * Lists claims synthesized for a research session.
   */
  static async getSessionClaims(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedQuery = claimsQuerySchema.parse(request.query);

    const result = await ResearchService.getSessionClaims(validatedParams.id, devUser.id, validatedQuery);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  }

  /**
   * Performs RAG hybrid vector and keyword search over evidence records.
   */
  static async searchEvidence(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedBody = searchEvidenceSchema.parse(request.body);

    const results = await ResearchService.searchEvidence(
      validatedParams.id,
      devUser.id,
      validatedBody
    );

    if (!results) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: results,
      total: results.length,
    });
  }

  /**
   * Fastify SSE handler streaming real-time agent execution progress events.
   */
  static async streamSessionEvents(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const sessionId = validatedParams.id;

    const session = await ResearchService.getSessionById(sessionId, devUser.id);
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${sessionId} not found`,
        },
      });
    }

    // Configure Fastify reply for Server-Sent Events (SSE)
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders();

    // Helper to format and write SSE data frames
    const sendSSE = (event: AgentStreamEvent) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Send initial handshake frame
    sendSSE({
      type: "CONNECTED",
      sessionId,
      timestamp: new Date().toISOString(),
      payload: { status: session.status },
    });

    // Event listener subscription
    const listener = (event: AgentStreamEvent) => {
      sendSSE(event);
    };

    AgentStreamService.subscribe(sessionId, listener);

    // Periodic heartbeat to prevent client socket timeout
    if (process.env.NODE_ENV !== "test") {
      const heartbeatInterval = setInterval(() => {
        reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
      }, 15000);

      // Socket disconnection teardown
      request.raw.on("close", () => {
        clearInterval(heartbeatInterval);
        AgentStreamService.unsubscribe(sessionId, listener);
      });
    } else {
      request.raw.on("close", () => {
        AgentStreamService.unsubscribe(sessionId, listener);
      });
      // In test environment, end response stream after flushing so app.inject resolves
      reply.raw.end();
    }
  }

  /**
   * Triggers session-wide pairwise claim contradiction analysis.
   */
  static async analyzeContradictions(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const report = await ResearchService.analyzeContradictions(validatedParams.id, devUser.id);
    if (!report) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: report,
    });
  }

  /**
   * Lists all detected claim contradictions for a research session.
   */
  static async getContradictions(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const contradictions = await ResearchService.getContradictions(validatedParams.id, devUser.id);
    if (!contradictions) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: contradictions,
      total: contradictions.length,
    });
  }

  /**
   * Retrieves token consumption and budget metrics for a session.
   */
  static async getSessionUsage(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const usage = await ResearchService.getSessionUsage(validatedParams.id, devUser.id);
    if (!usage) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: usage,
    });
  }

  /**
   * Exports a research report in Markdown, HTML, or JSON-LD format with headers.
   */
  static async exportReport(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedQuery = exportReportQuerySchema.parse(request.query);

    const result = await ResearchService.exportReport(
      validatedParams.id,
      devUser.id,
      validatedQuery.format
    );

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    reply.header("Content-Type", result.contentType);
    reply.header("Content-Disposition", `attachment; filename="${result.filename}"`);
    return reply.status(200).send(result.content);
  }

  /**
   * Scrapes web HTML metadata and computes domain & source credibility scores for a session.
   */
  static async scrapeSource(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedBody = scrapeSourceSchema.parse(request.body);

    const result = await ResearchService.scrapeAndScoreSource(
      validatedParams.id,
      devUser.id,
      validatedBody
    );

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  /**
   * Generates a declarative statistical chart spec from raw text/tabular data.
   */
  static async generateChart(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);
    const validatedBody = generateChartSchema.parse(request.body);

    const result = await ResearchService.generateChartSpec(
      validatedParams.id,
      devUser.id,
      validatedBody as any
    );

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  /**
   * Retrieves extracted chart specs generated from session evidence.
   */
  static async getSessionCharts(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const result = await ResearchService.getSessionCharts(validatedParams.id, devUser.id);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  /**
   * Retrieves pending or active HITL breakpoints for a research session.
   */
  static async getHitlCheckpoints(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = sessionParamsSchema.parse(request.params);

    const result = await ResearchService.getHitlCheckpoints(validatedParams.id, devUser.id);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session with ID ${validatedParams.id} not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  /**
   * Submits a human decision on a paused HITL breakpoint and resumes/replays workflow execution.
   */
  static async submitHitlDecision(request: FastifyRequest, reply: FastifyReply) {
    const devUser = await ResearchService.getOrCreateDevUser();
    const validatedParams = checkpointParamsSchema.parse(request.params);
    const validatedBody = submitHitlDecisionSchema.parse(request.body);

    const result = await ResearchService.submitHitlDecision(
      validatedParams.id,
      devUser.id,
      validatedParams.checkpointId,
      validatedBody
    );

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `Research session or HITL checkpoint not found`,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }
}









