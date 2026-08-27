import { z } from "zod";
import { ResearchSessionStatus } from "@prisma/client";

/**
 * Validation schema for creating a new research session.
 */
export const createSessionSchema = z.object({
  title: z
    .string({ required_error: "title is required" })
    .trim()
    .min(3, "title must be at least 3 characters")
    .max(200, "title cannot exceed 200 characters"),
  query: z
    .string({ required_error: "query is required" })
    .trim()
    .min(10, "query must be at least 10 characters")
    .max(5000, "query cannot exceed 5000 characters"),
  description: z
    .string()
    .trim()
    .max(10000, "description cannot exceed 10000 characters")
    .optional(),
});

/**
 * Validation schema for updating an existing research session.
 */
export const updateSessionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "title must be at least 3 characters")
    .max(200, "title cannot exceed 200 characters")
    .optional(),
  query: z
    .string()
    .trim()
    .min(10, "query must be at least 10 characters")
    .max(5000, "query cannot exceed 5000 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(10000, "description cannot exceed 10000 characters")
    .optional(),
  status: z
    .nativeEnum(ResearchSessionStatus, {
      errorMap: () => ({ message: "invalid session status" }),
    })
    .optional(),
});

/**
 * Validation schema for research session URL parameters.
 */
export const sessionParamsSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

/**
 * Validation schema for research session query parameters (pagination, filter).
 */
export const sessionQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return 10;
      return parsed > 100 ? 100 : parsed;
    }),
  status: z.nativeEnum(ResearchSessionStatus).optional(),
});

// Infer TypeScript types from Zod schemas
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type SessionParams = z.infer<typeof sessionParamsSchema>;
export type SessionQuery = z.infer<typeof sessionQuerySchema>;

/**
 * Zod validation schema for tasks query pagination and filtering.
 */
export const tasksQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return 10;
      return parsed > 100 ? 100 : parsed;
    }),
  status: z.string().optional(),
});

/**
 * Zod validation schema for sources query pagination and filtering.
 */
export const sourcesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return 10;
      return parsed > 100 ? 100 : parsed;
    }),
  sourceType: z.string().optional(),
});

/**
 * Zod validation schema for evidence query pagination.
 */
export const evidenceQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return 10;
      return parsed > 100 ? 100 : parsed;
    }),
});

/**
 * Zod validation schema for claims query pagination and filtering.
 */
export const claimsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return 10;
      return parsed > 100 ? 100 : parsed;
    }),
  status: z.string().optional(),
});

export type TasksQuery = z.infer<typeof tasksQuerySchema>;
export type SourcesQuery = z.infer<typeof sourcesQuerySchema>;
export type EvidenceQuery = z.infer<typeof evidenceQuerySchema>;
export type ClaimsQuery = z.infer<typeof claimsQuerySchema>;
