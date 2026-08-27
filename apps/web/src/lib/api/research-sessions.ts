import { fetchApi } from "./client";
import type {
  ResearchSession,
  CreateSessionInput,
  UpdateSessionInput,
  PlanSessionResponse,
  ExecuteSessionResponse,
  SessionProgressResponse,
  ResearchTask,
  SessionReportResponse,
  PaginationMeta,
} from "./types";

export class ResearchSessionsApi {
  /**
   * Fetches paginated research sessions for the dashboard.
   */
  static async list(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ items: ResearchSession[]; pagination: PaginationMeta }> {
    const queryParts: string[] = [];
    if (params?.page) queryParts.push(`page=${params.page}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.status && params.status !== "ALL") queryParts.push(`status=${encodeURIComponent(params.status)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    const res = await fetchApi<ResearchSession[]>(`/research-sessions${queryString}`);

    return {
      items: res.data,
      pagination: res.pagination || { page: 1, limit: 10, total: res.data.length, totalPages: 1 },
    };
  }

  /**
   * Creates a new research session.
   */
  static async create(data: CreateSessionInput): Promise<ResearchSession> {
    const res = await fetchApi<ResearchSession>("/research-sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  }

  /**
   * Retrieves a single research session by UUID.
   */
  static async get(id: string): Promise<ResearchSession> {
    const res = await fetchApi<ResearchSession>(`/research-sessions/${id}`);
    return res.data;
  }

  /**
   * Updates research session attributes or status.
   */
  static async update(id: string, data: UpdateSessionInput): Promise<ResearchSession> {
    const res = await fetchApi<ResearchSession>(`/research-sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  }

  /**
   * Deletes a research session.
   */
  static async delete(id: string): Promise<boolean> {
    await fetchApi<{ message: string }>(`/research-sessions/${id}`, {
      method: "DELETE",
    });
    return true;
  }

  /**
   * Generates a structured research plan via the Orchestrator agent.
   */
  static async plan(id: string): Promise<PlanSessionResponse> {
    const res = await fetchApi<PlanSessionResponse>(`/research-sessions/${id}/plan`, {
      method: "POST",
    });
    return res.data;
  }

  /**
   * Triggers asynchronous background task execution via BullMQ queue.
   */
  static async execute(id: string): Promise<ExecuteSessionResponse> {
    const res = await fetchApi<ExecuteSessionResponse>(`/research-sessions/${id}/execute`, {
      method: "POST",
    });
    return res.data;
  }

  /**
   * Retrieves real-time execution progress metrics.
   */
  static async getProgress(id: string): Promise<SessionProgressResponse> {
    const res = await fetchApi<SessionProgressResponse>(`/research-sessions/${id}/progress`);
    return res.data;
  }

  /**
   * Retrieves planned tasks for a research session.
   */
  static async getTasks(
    id: string,
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<{ items: ResearchTask[]; pagination: PaginationMeta }> {
    const queryParts: string[] = [];
    if (params?.page) queryParts.push(`page=${params.page}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    if (params?.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    const res = await fetchApi<ResearchTask[]>(`/research-sessions/${id}/tasks${queryString}`);

    return {
      items: res.data,
      pagination: res.pagination || { page: 1, limit: 10, total: res.data.length, totalPages: 1 },
    };
  }

  /**
   * Retrieves final report synthesized by SynthesisAgent.
   */
  static async getReport(id: string): Promise<SessionReportResponse> {
    const res = await fetchApi<SessionReportResponse>(`/research-sessions/${id}/report`);
    return res.data;
  }
}
