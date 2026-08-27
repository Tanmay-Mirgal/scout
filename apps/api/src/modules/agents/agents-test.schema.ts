import { z } from "zod";

/**
 * Validation schema for the agent execution development endpoint.
 */
export const agentTestRequestSchema = z.object({
  agentType: z
    .string({ required_error: "agentType is required" })
    .trim()
    .min(1, "agentType cannot be empty"),
  query: z
    .string({ required_error: "query is required" })
    .trim()
    .min(1, "query cannot be empty"),
  researchSessionId: z
    .string()
    .uuid("researchSessionId must be a valid UUID")
    .optional(),
  researchTaskId: z
    .string()
    .uuid("researchTaskId must be a valid UUID")
    .optional(),
});

export type AgentTestInput = z.infer<typeof agentTestRequestSchema>;
