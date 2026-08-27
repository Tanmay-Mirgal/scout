import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

// Validation schema for extracted claims
export const claimsSchema = z.object({
  claims: z.array(
    z.object({
      content: z.string({ required_error: "Claim statement content is required." }),
      reasoning: z.string({ required_error: "Relevance reasoning is required." }),
    })
  ),
});

/**
 * Claim Agent responsible for analyzing extracted evidence facts and
 * synthesizing the core, meaningful research claims to verify.
 */
export class ClaimAgent extends BaseAgent {
  readonly name = "Claim Agent";
  readonly type = "CLAIM";
  readonly description = "Synthesizes meaningful claims from extracted evidence facts.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();
    const evidenceJson = context.context || "";

    let evidenceList = [];
    try {
      if (evidenceJson.trim() !== "") {
        const parsed = JSON.parse(evidenceJson);
        evidenceList = parsed.evidence || parsed || [];
      }
    } catch {
      return {
        success: false,
        output: "",
        error: "Evidence context input must be a valid JSON string.",
        metadata: { code: "CLAIM_EXTRACTION_FAILED" },
      };
    }

    if (evidenceList.length === 0) {
      return {
        success: true,
        output: JSON.stringify({ claims: [] }),
        metadata: { claimCount: 0 },
      };
    }

    const systemPrompt = `You are the SCOUT Claim Agent. 
Your goal is to analyze a list of extracted evidence facts and synthesize the core, meaningful claims that are raised by the research findings.
Ensure claims are clear, distinct, and falsifiable (e.g. "Flow batteries suffer from low round-trip efficiency of 65-75%").
Avoid duplicates or overlapping claims.
Your output MUST be a valid JSON object strictly matching the schema format:
{
  "claims": [
    {
      "content": "Flow batteries suffer from lower round-trip efficiency than lithium-ion solutions",
      "reasoning": "Directly supported by efficiency statistics extracted from technical reports"
    }
  ]
}`;

    const userPrompt = `Research Objective: "${context.query}"

Extracted Evidence List:
${JSON.stringify(evidenceList, null, 2)}`;

    try {
      const extracted = await provider.generateStructured(
        {
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt,
          temperature: 0.2,
        },
        claimsSchema
      );

      return {
        success: true,
        output: JSON.stringify(extracted),
        metadata: {
          claimCount: extracted.claims.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Claim Agent synthesis failed: ${err.message}`,
        metadata: {
          code: err.code || "CLAIM_EXTRACTION_FAILED",
        },
      };
    }
  }
}
export default ClaimAgent;
