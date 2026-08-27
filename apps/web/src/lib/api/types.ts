/**
 * SCOUT API Type Definitions
 * Aligned strictly with Fastify backend schemas and Prisma domain model.
 */

export type ResearchSessionStatus =
  | "DRAFT"
  | "QUEUED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ResearchSession {
  id: string;
  title: string;
  query: string;
  description: string | null;
  status: ResearchSessionStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  userId: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  pagination?: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface CreateSessionInput {
  title: string;
  query: string;
  description?: string;
}

export interface UpdateSessionInput {
  title?: string;
  query?: string;
  description?: string;
  status?: ResearchSessionStatus;
}

export interface ResearchTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  researchSessionId: string;
}

export interface PlanTaskItem {
  title: string;
  description: string;
  priority: TaskPriority;
  status: string;
}

export interface PlanSessionResponse {
  researchSessionId: string;
  status: ResearchSessionStatus;
  tasks: PlanTaskItem[];
}

export interface ExecuteSessionResponse {
  researchSessionId: string;
  status: ResearchSessionStatus;
  totalTasks: number;
  queuedTasks: number;
}

export interface ProgressMetrics {
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  percentage: number;
}

export interface SessionProgressResponse {
  researchSessionId: string;
  status: ResearchSessionStatus;
  progress: ProgressMetrics;
}

export interface ReportKeyFinding {
  finding: string;
  confidence: number;
  citations?: string[];
}

export interface ReportDetailedAnalysisSection {
  sectionTitle: string;
  content: string;
  citations?: string[];
}

export interface ReportContradiction {
  topic: string;
  explanation: string;
  citations?: string[];
}

export interface ReportMethodology {
  overview: string;
  tasksCompleted: number;
  tasksFailed: number;
  sourcesAnalyzed: number;
}

export interface ReportContent {
  title: string;
  executiveSummary: string;
  researchQuestion: string;
  methodology: ReportMethodology;
  keyFindings: ReportKeyFinding[];
  detailedAnalysis: ReportDetailedAnalysisSection[];
  contradictions: ReportContradiction[];
  limitations: string[];
  conclusion: string;
}

export interface ReportData {
  id: string;
  title: string;
  content: ReportContent;
}

export interface SessionReportResponse {
  researchSessionId: string;
  status: ResearchSessionStatus;
  report: ReportData | null;
}
