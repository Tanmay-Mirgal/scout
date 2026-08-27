import type { ApiErrorPayload, ApiSuccessResponse } from "./types";

/**
 * Custom error class capturing structured SCOUT backend API errors.
 */
export class ScoutApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(message: string, code: string = "API_ERROR", status: number = 500, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = "ScoutApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Gets the configured base URL for SCOUT backend.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/$/, "");
  }
  return "http://localhost:4000";
}

/**
 * Centralized fetch wrapper for communicating with Fastify backend.
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; pagination?: any }> {
  const baseUrl = getApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  
  // Prepend /api/v1 prefix if not already present
  const fullUrl = path.startsWith("/api/v1") ? `${baseUrl}${path}` : `${baseUrl}/api/v1${path}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ScoutApiError(
      `Unable to connect to SCOUT backend server at ${baseUrl}. Please ensure the Fastify server is running.`,
      "NETWORK_ERROR",
      0
    );
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new ScoutApiError(
      `Invalid JSON response received from API (${response.status} ${response.statusText}).`,
      "INVALID_RESPONSE",
      response.status
    );
  }

  if (!response.ok || payload?.success === false) {
    const errorPayload: ApiErrorPayload | undefined = payload?.error;
    const message = errorPayload?.message || `Request failed with status ${response.status}`;
    const code = errorPayload?.code || `HTTP_${response.status}`;
    const details = errorPayload?.details;

    throw new ScoutApiError(message, code, response.status, details);
  }

  const successPayload = payload as ApiSuccessResponse<T>;
  return {
    data: successPayload.data,
    pagination: successPayload.pagination,
  };
}
