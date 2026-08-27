import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

// Schema defining the structured research plan response from the Orchestrator
export const researchPlanSchema = z.object({
  objective: z.string({ required_error: "Plan objective is required." }),
  tasks: z.array(
    z.object({
      title: z.string({ required_error: "Task title is required." }),
      description: z.string({ required_error: "Task description is required." }),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      expectedOutput: z.string({ required_error: "Expected output description is required." }),
    })
  ).min(1, "Plan must contain at least one task."),
});

/**
 * Orchestrator Agent responsible for breaking research session queries
 * down into structured, discrete tasks with assigned priorities.
 */
export class OrchestratorAgent extends BaseAgent {
  readonly name = "Orchestrator Agent";
  readonly type = "ORCHESTRATOR";
  readonly description = "Generates modular task plans based on complex research queries.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();

    const systemPrompt = `You are the SCOUT Orchestrator Agent. 
Your goal is to analyze a complex research query and create a structured research plan.
Break the objective down into distinct, logical research tasks (e.g. historical context search, data comparison, verification of key statistics).
Provide a clear description, priority, and expected output for each task. Do not create overlapping or duplicate tasks.
Your output MUST be a valid JSON object strictly matching the schema format:
{
  "objective": "Summarized query goal",
  "tasks": [
    {
      "title": "Task Title",
      "description": "Task Description detailing what to research",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "expectedOutput": "What finding data is expected"
    }
  ]
}`;

    const userPrompt = `Research Question: "${context.query}"`;

    try {
      const plan = await provider.generateStructured(
        {
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt,
          temperature: 0.2,
        },
        researchPlanSchema
      );

      return {
        success: true,
        output: JSON.stringify(plan),
        metadata: {
          objective: plan.objective,
          taskCount: plan.tasks.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Orchestration planning failed: ${err.message}`,
        metadata: {
          code: err.code || "ORCHESTRATION_FAILED",
        },
      };
    }
  }
}
export default OrchestratorAgent;
