import { prisma } from "../../lib/prisma";
import type { 
  CreateSessionInput, 
  UpdateSessionInput, 
  SessionQuery,
  TasksQuery,
  SourcesQuery,
  EvidenceQuery,
  ClaimsQuery
} from "./research.schema";
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
}
