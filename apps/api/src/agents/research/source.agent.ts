import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

// Validation schema for source credibility evaluations
export const sourceEvaluationSchema = z.object({
  relevant: z.boolean(),
  credibilityScore: z.number().min(0).max(1),
  relevanceScore: z.number().min(0).max(1),
  reasoning: z.string({ required_error: "Evaluation reasoning is required." }),
  sourceType: z.enum([
    "ARTICLE",
    "RESEARCH_PAPER",
    "GOVERNMENT_REPORT",
    "DATASET",
    "DOCUMENTATION",
    "NEWS",
    "WEBSITE",
    "OTHER",
  ]),
});

/**
 * Source Agent responsible for evaluating search result candidates,
 * estimating credibility scores (0.0 to 1.0), and classifying resource types.
 */
export class SourceAgent extends BaseAgent {
  readonly name = "Source Agent";
  readonly type = "SOURCE";
  readonly description = "Evaluates source details, estimates credibility, and categorizes resource types.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();

    let candidate: { title?: string; url?: string; snippet?: string } = {};
    try {
      candidate = JSON.parse(context.context || "{}");
    } catch {
      return {
        success: false,
        output: "",
        error: "Candidate source context must be a valid JSON string.",
        metadata: { code: "SOURCE_ANALYSIS_FAILED" },
      };
    }

    const systemPrompt = `You are the SCOUT Source Agent. 
Your goal is to evaluate the credibility, relevance, and type of a candidate web source in reference to a research task objective.
Assign a credibility score between 0.0 (unreliable/spam) and 1.0 (academic/official government resources) and relevance score (0.0 to 1.0).
Use signals like:
- Domain quality (e.g. government '.gov', edu '.edu', well-known academic registries '.org' vs commercial blog posts)
- Resource publisher type
- Date of publication presence
Your output MUST be a valid JSON object strictly matching the schema format:
{
  "relevant": true | false,
  "credibilityScore": 0.85,
  "relevanceScore": 0.90,
  "reasoning": "Explain the evaluation details based on domains and snippets",
  "sourceType": "ARTICLE" | "RESEARCH_PAPER" | "GOVERNMENT_REPORT" | "DATASET" | "DOCUMENTATION" | "NEWS" | "WEBSITE" | "OTHER"
}`;

    const userPrompt = `Research Objective: "${context.query}"

Candidate Source details:
Title: "${candidate.title || "Untitled"}"
URL: "${candidate.url || "N/A"}"
Snippet: "${candidate.snippet || "N/A"}"`;

    try {
      const evaluation = await provider.generateStructured(
        {
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt,
          temperature: 0.1,
        },
        sourceEvaluationSchema
      );

      return {
        success: true,
        output: JSON.stringify(evaluation),
        metadata: {
          url: candidate.url,
          evaluation,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Source Agent evaluation failed: ${err.message}`,
        metadata: {
          code: err.code || "SOURCE_ANALYSIS_FAILED",
        },
      };
    }
  }
}
export default SourceAgent;
