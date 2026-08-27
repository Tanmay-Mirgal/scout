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
} from "./research.schema";
import { ResearchPlanningService } from "../../services/research-planning.service";
import { ResearchExecutionService } from "../../services/research-execution.service";
import { ResearchSessionExecutionService } from "../../services/research-session-execution.service";
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

    const data = await ResearchSessionExecutionService.startExecution(validatedParams.id, devUser.id);

    return reply.status(200).send({
      success: true,
      data,
    });
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
}
