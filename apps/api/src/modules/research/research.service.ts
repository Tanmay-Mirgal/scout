import { prisma } from "../../lib/prisma";
import type { 
  CreateSessionInput, 
  UpdateSessionInput, 
  SessionQuery,
  TasksQuery,
  SourcesQuery,
  EvidenceQuery,
  ClaimsQuery,
  SearchEvidenceInput
} from "./research.schema";
import { HybridSearchService } from "../../services/hybrid-search.service";
import { ContradictionEngineService } from "../../services/contradiction-engine.service";
import { TokenBudgetService } from "../../services/token-budget.service";
import { ReportExportService, ExportFormat } from "../../services/report-export.service";
import { SourceScraperService } from "../../services/source-scraper.service";
import { DataScoutService, ChartType } from "../../services/datascout-chart.service";
import { HITLWorkflowEngine, HITLAction } from "../../services/hitl-workflow.service";
import { ResearchSessionStatus } from "@prisma/client";

/**
 * Service layer to handle database interaction and business logic for Research Sessions.
 */
export class ResearchService {
  /**
   * Retrieves or deterministically creates the temporary development user.
   * Keeps authentication logic isolated for future replacement.
   */
  static async getOrCreateDevUser() {
    const email = "dev@scout.local";
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: "Development User",
        },
      });
    }

    return user;
  }

  /**
   * Creates a new Research Session associated with the dev user.
   */
  static async createSession(data: CreateSessionInput, userId: string) {
    return prisma.researchSession.create({
      data: {
        title: data.title,
        query: data.query,
        description: data.description,
        status: ResearchSessionStatus.DRAFT,
        userId,
      },
    });
  }

  /**
   * Lists research sessions for the dev user with pagination and status filters.
   */
  static async listSessions(userId: string, query: SessionQuery) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    const [total, items] = await Promise.all([
      prisma.researchSession.count({ where }),
      prisma.researchSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single research session by ID, verifying ownership.
   */
  static async getSessionById(id: string, userId: string) {
    const session = await prisma.researchSession.findUnique({
      where: { id },
    });

    if (!session || session.userId !== userId) {
      return null;
    }

    return session;
  }

  /**
   * Updates fields of a research session, validating ownership.
   */
  static async updateSession(id: string, userId: string, data: UpdateSessionInput) {
    const session = await this.getSessionById(id, userId);
    if (!session) {
      return null;
    }

    return prisma.researchSession.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a research session and cascades to related models.
   */
  static async deleteSession(id: string, userId: string) {
    const session = await this.getSessionById(id, userId);
    if (!session) {
      return null;
    }

    await prisma.researchSession.delete({
      where: { id },
    });

    return true;
  }

  /**
   * Lists tasks for a research session with pagination.
   */
  static async getSessionTasks(sessionId: string, userId: string, query: TasksQuery) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { researchSessionId: sessionId };
    if (status) {
      where.status = status;
    }

    const [total, items] = await Promise.all([
      prisma.researchTask.count({ where }),
      prisma.researchTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lists sources for a research session with pagination.
   */
  static async getSessionSources(sessionId: string, userId: string, query: SourcesQuery) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    const { page, limit, sourceType } = query;
    const skip = (page - 1) * limit;

    const where: any = { researchSessionId: sessionId };
    if (sourceType) {
      where.sourceType = sourceType;
    }

    const [total, items] = await Promise.all([
      prisma.source.count({ where }),
      prisma.source.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lists evidence records for a research session with pagination.
   */
  static async getSessionEvidence(sessionId: string, userId: string, query: EvidenceQuery) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where = { researchSessionId: sessionId };

    const [total, items] = await Promise.all([
      prisma.evidence.count({ where }),
      prisma.evidence.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lists claims synthesized for a research session with pagination.
   */
  static async getSessionClaims(sessionId: string, userId: string, query: ClaimsQuery) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { researchSessionId: sessionId };
    if (status) {
      where.status = status;
    }

    const [total, items] = await Promise.all([
      prisma.claim.count({ where }),
      prisma.claim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Performs RAG hybrid vector and keyword search over evidence for a research session.
   */
  static async searchEvidence(
    sessionId: string,
    userId: string,
    input: SearchEvidenceInput
  ) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    return HybridSearchService.searchEvidence({
      sessionId,
      query: input.query,
      limit: input.limit,
      alpha: input.alpha,
      minRelevanceScore: input.minRelevanceScore,
    });
  }

  /**
   * Triggers automated pairwise claim contradiction analysis for a session.
   */
  static async analyzeContradictions(sessionId: string, userId: string) {
    return ContradictionEngineService.analyzeSessionContradictions(sessionId, userId);
  }

  /**
   * Retrieves all detected claim contradictions for a research session.
   */
  static async getContradictions(sessionId: string, userId: string) {
    return ContradictionEngineService.getSessionContradictions(sessionId, userId);
  }

  /**
   * Retrieves token usage and budget metrics for a research session.
   */
  static async getSessionUsage(sessionId: string, userId: string) {
    return TokenBudgetService.getSessionUsage(sessionId, userId);
  }

  /**
   * Exports a research report in Markdown, HTML, or JSON-LD format with citation tree.
   */
  static async exportReport(sessionId: string, userId: string, format: ExportFormat) {
    return ReportExportService.exportReport(sessionId, userId, format);
  }

  /**
   * Scrapes web metadata and computes domain/source credibility scores for a research session source.
   */
  static async scrapeAndScoreSource(
    sessionId: string,
    userId: string,
    params: { url: string; sourceType?: any; htmlContent?: string }
  ) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    return SourceScraperService.scrapeAndScoreSource({
      researchSessionId: sessionId,
      url: params.url,
      sourceType: params.sourceType,
      htmlContent: params.htmlContent,
    });
  }

  /**
   * Generates a declarative chart specification from raw tabular text or evidence.
   */
  static async generateChartSpec(
    sessionId: string,
    userId: string,
    params: { text: string; chartType?: ChartType; title?: string }
  ) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    return DataScoutService.generateChartSpec(params.text, params.chartType, params.title, sessionId);
  }

  /**
   * Scans session evidence records and generates interactive statistical chart specs.
   */
  static async getSessionCharts(sessionId: string, userId: string) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    return DataScoutService.processSessionCharts(sessionId, userId);
  }

  /**
   * Retrieves all active HITL breakpoints/checkpoints for a session.
   */
  static async getHitlCheckpoints(sessionId: string, userId: string, pendingOnly: boolean = false) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    return HITLWorkflowEngine.getSessionCheckpoints(sessionId, userId, pendingOnly);
  }

  /**
   * Submits a human decision on a HITL checkpoint and resumes or cancels workflow execution.
   */
  static async submitHitlDecision(
    sessionId: string,
    userId: string,
    checkpointId: string,
    params: { action: HITLAction; modifiedInput?: any; feedback?: string }
  ) {
    const session = await this.getSessionById(sessionId, userId);
    if (!session) return null;

    return HITLWorkflowEngine.submitDecision({
      sessionId,
      userId,
      checkpointId,
      action: params.action,
      modifiedInput: params.modifiedInput,
      feedback: params.feedback,
    });
  }
}







