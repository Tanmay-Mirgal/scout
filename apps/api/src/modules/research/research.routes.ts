import type { FastifyInstance } from "fastify";
import { ResearchController } from "./research.controller";

// Reusable response schema for a Research Session entity
const sessionResponseSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    query: { type: "string" },
    description: { type: "string", nullable: true },
    status: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    completedAt: { type: "string", nullable: true },
    userId: { type: "string", format: "uuid" },
  },
};

// Reusable pagination response schema
const paginationSchema = {
  type: "object",
  properties: {
    page: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    totalPages: { type: "integer" },
  },
};

/**
 * Fastify route plugin for Research Sessions.
 * Maps endpoints to Controller handlers and configures Swagger documentation with complete schemas.
 */
export async function researchRoutes(app: FastifyInstance) {
  // POST /api/v1/research-sessions
  app.post(
    "/research-sessions",
    {
      schema: {
        description: "Create a new research session",
        tags: ["Research Sessions"],
        body: {
          type: "object",
          required: ["title", "query"],
          properties: {
            title: { type: "string", minLength: 3, maxLength: 200 },
            query: { type: "string", minLength: 10, maxLength: 5000 },
            description: { type: "string", maxLength: 10000 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: sessionResponseSchema,
            },
          },
        },
      },
    },
    ResearchController.createSession
  );

  // GET /api/v1/research-sessions
  app.get(
    "/research-sessions",
    {
      schema: {
        description: "List all research sessions with pagination and filtering",
        tags: ["Research Sessions"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "10" },
            status: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "array", items: sessionResponseSchema },
              pagination: paginationSchema,
            },
          },
        },
      },
    },
    ResearchController.listSessions
  );

  // GET /api/v1/research-sessions/:id
  app.get(
    "/research-sessions/:id",
    {
      schema: {
        description: "Retrieve a single research session by ID",
        tags: ["Research Sessions"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: sessionResponseSchema,
            },
          },
        },
      },
    },
    ResearchController.getSessionById
  );

  // PATCH /api/v1/research-sessions/:id
  app.patch(
    "/research-sessions/:id",
    {
      schema: {
        description: "Update details or status of a research session",
        tags: ["Research Sessions"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 3, maxLength: 200 },
            query: { type: "string", minLength: 10, maxLength: 5000 },
            description: { type: "string", maxLength: 10000 },
            status: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: sessionResponseSchema,
            },
          },
        },
      },
    },
    ResearchController.updateSession
  );

  // DELETE /api/v1/research-sessions/:id
  app.delete(
    "/research-sessions/:id",
    {
      schema: {
        description: "Delete an existing research session",
        tags: ["Research Sessions"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    ResearchController.deleteSession
  );

  // POST /api/v1/research-sessions/:id/plan
  app.post(
    "/research-sessions/:id/plan",
    {
      schema: {
        description: "Generate tasks research plan for a session",
        tags: ["Research Pipeline"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  researchSessionId: { type: "string", format: "uuid" },
                  objective: { type: "string" },
                  status: { type: "string" },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        title: { type: "string" },
                        description: { type: "string", nullable: true },
                        priority: { type: "string" },
                        status: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ResearchController.planSession
  );

  // POST /api/v1/research-sessions/:id/execute
  app.post(
    "/research-sessions/:id/execute",
    {
      schema: {
        description: "Trigger asynchronous execution of planned research tasks via queue",
        tags: ["Research Pipeline"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  researchSessionId: { type: "string", format: "uuid" },
                  status: { type: "string" },
                  totalTasks: { type: "integer" },
                  queuedTasks: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    ResearchController.executeSession
  );

  // GET /api/v1/research-sessions/:id/progress
  app.get(
    "/research-sessions/:id/progress",
    {
      schema: {
        description: "Get persistent execution progress metrics for a research session",
        tags: ["Research Pipeline"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  researchSessionId: { type: "string", format: "uuid" },
                  status: { type: "string" },
                  progress: {
                    type: "object",
                    properties: {
                      totalTasks: { type: "integer" },
                      pending: { type: "integer" },
                      inProgress: { type: "integer" },
                      completed: { type: "integer" },
                      failed: { type: "integer" },
                      percentage: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ResearchController.getSessionProgress
  );

  // GET /api/v1/research-sessions/:id/report
  app.get(
    "/research-sessions/:id/report",
    {
      schema: {
        description: "Retrieve final synthesized report for a research session",
        tags: ["Research Pipeline"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  researchSessionId: { type: "string", format: "uuid" },
                  status: { type: "string" },
                  report: {
                    type: "object",
                    nullable: true,
                    properties: {
                      id: { type: "string", format: "uuid" },
                      title: { type: "string" },
                      content: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    ResearchController.getSessionReport
  );

  // GET /api/v1/research-sessions/:id/tasks
  app.get(
    "/research-sessions/:id/tasks",
    {
      schema: {
        description: "List tasks for a research session with pagination",
        tags: ["Research Pipeline Data"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "10" },
            status: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    title: { type: "string" },
                    description: { type: "string", nullable: true },
                    priority: { type: "string" },
                    status: { type: "string" },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                    completedAt: { type: "string", nullable: true },
                  },
                },
              },
              pagination: paginationSchema,
            },
          },
        },
      },
    },
    ResearchController.getSessionTasks
  );

  // GET /api/v1/research-sessions/:id/sources
  app.get(
    "/research-sessions/:id/sources",
    {
      schema: {
        description: "List sources for a research session with pagination",
        tags: ["Research Pipeline Data"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "10" },
            sourceType: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    title: { type: "string" },
                    url: { type: "string" },
                    publisher: { type: "string", nullable: true },
                    publishedAt: { type: "string", nullable: true },
                    credibilityScore: { type: "number", nullable: true },
                    sourceType: { type: "string" },
                  },
                },
              },
              pagination: paginationSchema,
            },
          },
        },
      },
    },
    ResearchController.getSessionSources
  );

  // GET /api/v1/research-sessions/:id/evidence
  app.get(
    "/research-sessions/:id/evidence",
    {
      schema: {
        description: "List evidence records for a research session with pagination",
        tags: ["Research Pipeline Data"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "10" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    content: { type: "string" },
                    summary: { type: "string", nullable: true },
                    location: { type: "string", nullable: true },
                    relevanceScore: { type: "number", nullable: true },
                    confidenceScore: { type: "number", nullable: true },
                    sourceId: { type: "string", format: "uuid" },
                  },
                },
              },
              pagination: paginationSchema,
            },
          },
        },
      },
    },
    ResearchController.getSessionEvidence
  );

  // GET /api/v1/research-sessions/:id/claims
  app.get(
    "/research-sessions/:id/claims",
    {
      schema: {
        description: "List synthesized claims for a research session with pagination",
        tags: ["Research Pipeline Data"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "string", default: "1" },
            limit: { type: "string", default: "10" },
            status: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    content: { type: "string" },
                    status: { type: "string" },
                    confidenceScore: { type: "number", nullable: true },
                    reasoning: { type: "string", nullable: true },
                  },
                },
              },
              pagination: paginationSchema,
            },
          },
        },
      },
    },
    ResearchController.getSessionClaims
  );
}
