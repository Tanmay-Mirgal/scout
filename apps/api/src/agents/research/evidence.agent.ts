import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

// Validation schema for extracted evidence
export const evidenceSchema = z.object({
  evidence: z.array(
    z.object({
      content: z.string({ required_error: "Factual content is required." }),
      summary: z.string({ required_error: "Short summary is required." }),
      location: z.string().nullable().optional(),
      relevanceScore: z.number().min(0).max(1),
      confidenceScore: z.number().min(0).max(1),
    })
  ),
});

/**
 * Evidence Agent responsible for parsing raw source content text,
 * extracting specific factual claims, quotes, statistics, and scoring relevance.
 */
export class EvidenceAgent extends BaseAgent {
  readonly name = "Evidence Agent";
  readonly type = "EVIDENCE";
  readonly description = "Extracts factual snippets, parameters, and statistics from source content.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();
    const sourceContent = context.context || "";

    if (sourceContent.trim() === "") {
      return {
        success: true,
        output: JSON.stringify({ evidence: [] }),
        metadata: { extractedCount: 0 },
      };
    }

    const systemPrompt = `You are the SCOUT Evidence Agent. 
Your goal is to extract factual findings, research data, specific quotes, and numbers from the provided raw web content text that relates to the Research Task.
Avoid capturing vague generalizations. Focus on cold, hard research facts.
For each extracted item, specify:
- content: exact factual excerpt or statement
- summary: concise summary of the fact
- location: section heading or paragraph detail if available
- relevanceScore: (0.0 to 1.0)
- confidenceScore: (0.0 to 1.0) based on source assertiveness
Your output MUST be a valid JSON object strictly matching the schema format:
{
  "evidence": [
    {
      "content": "Lithium-ion batteries hold 85% of grid storage share as of 2024",
      "summary": "Lithium-ion grid storage market share",
      "location": "Grid Storage Overview",
      "relevanceScore": 0.90,
      "confidenceScore": 0.95
    }
  ]
}`;

    const userPrompt = `Research Task: "${context.query}"

Raw Source Content Text:
"""
${sourceContent}
"""`;

    try {
      const extracted = await provider.generateStructured(
        {
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt,
          temperature: 0.1,
        },
        evidenceSchema
      );

      return {
        success: true,
        output: JSON.stringify(extracted),
        metadata: {
          extractedCount: extracted.evidence.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Evidence Agent extraction failed: ${err.message}`,
        metadata: {
          code: err.code || "EVIDENCE_EXTRACTION_FAILED",
        },
      };
    }
  }
}
export default EvidenceAgent;
