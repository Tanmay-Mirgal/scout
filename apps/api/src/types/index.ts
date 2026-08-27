/**
 * Shared API types for the SCOUT backend.
 * Additional types will be added here as features are implemented.
 */

/**
 * Standard API response envelope.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Standard health check response.
 */
export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  service: string;
}
