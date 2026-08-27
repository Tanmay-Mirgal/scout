import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

// Validation schema for Critic Agent verification assessments
export const criticVerificationSchema = z.object({
  status: z.enum(["SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE"]),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string({ required_error: "Critic reasoning is required." }),
  mappings: z.array(
    z.object({
      evidenceIndex: z.number(), // Mapped to the index of evidence in context.context list
      relationship: z.enum(["SUPPORTS", "CONTRADICTS", "RELATES_TO"]),
      strength: z.number().min(0).max(1),
      reasoning: z.string({ required_error: "Relationship reasoning is required." }),
    })
  ),
});

/**
 * Critic Agent responsible for analyzing a specific claim against all collected evidence,
 * mapping relationships (SUPPORTS, CONTRADICTS, RELATES_TO), and assigning the final verified status.
 */
export class CriticAgent extends BaseAgent {
  readonly name = "Critic Agent";
  readonly type = "CRITIC";
  readonly description = "Verifies claims against gathered evidence list and maps relationship weights.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();
    const claimContent = context.query;
    const evidenceListJson = context.context || "[]";

    let evidenceList = [];
    try {
      evidenceList = JSON.parse(evidenceListJson);
    } catch {
      return {
        success: false,
        output: "",
        error: "Evidence list context must be a valid JSON string.",
        metadata: { code: "CLAIM_VERIFICATION_FAILED" },
      };
    }

    if (evidenceList.length === 0) {
      return {
        success: true,
        output: JSON.stringify({
          status: "INSUFFICIENT_EVIDENCE",
          confidenceScore: 0.0,
          reasoning: "No evidence was collected to support or contradict the claim.",
          mappings: [],
        }),
        metadata: { status: "INSUFFICIENT_EVIDENCE" },
      };
    }

    const systemPrompt = `You are the SCOUT Critic / Verification Agent.
Your goal is to evaluate a single Claim against a list of collected Evidence items.
For each Evidence item, analyze if it:
- SUPPORTS: directly verifies or strengthens the claim
- CONTRADICTS: disproves or weakens the claim
- RELATES_TO: references the topic but does not prove or disprove it
Assign a strength score between 0.0 and 1.0 for each mapping.
Based on the mappings, evaluate the final status of the claim:
- SUPPORTED: Multiple credible sources support it, and there are no strong contradictions.
- CONTRADICTED: Credible evidence directly refutes the claim.
- INSUFFICIENT_EVIDENCE: Weak support or too few sources to draw a conclusion.
Be highly conservative! Do not verify claims backed by weak or single uncorroborated sources.
Your output MUST be a valid JSON object strictly matching the schema format:
{
  "status": "SUPPORTED" | "CONTRADICTED" | "INSUFFICIENT_EVIDENCE",
  "confidenceScore": 0.85,
  "reasoning": "Detailed justification of the status based on credibility and counts",
  "mappings": [
    {
      "evidenceIndex": 0,
      "relationship": "SUPPORTS" | "CONTRADICTS" | "RELATES_TO",
      "strength": 0.90,
      "reasoning": "Why this evidence supports/contradicts/relates to the claim"
    }
  ]
}`;

    const userPrompt = `Claim to Verify: "${claimContent}"

Collected Evidence List:
${JSON.stringify(
  evidenceList.map((e: any, index: number) => ({
    index,
    summary: e.summary,
    content: e.content,
  })),
  null,
  2
)}`;

    try {
      const evaluation = await provider.generateStructured(
        {
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt,
          temperature: 0.1,
        },
        criticVerificationSchema
      );

      return {
        success: true,
        output: JSON.stringify(evaluation),
        metadata: {
          status: evaluation.status,
          mappingsCount: evaluation.mappings.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Critic Agent verification failed: ${err.message}`,
        metadata: {
          code: err.code || "CLAIM_VERIFICATION_FAILED",
        },
      };
    }
  }
}
export default CriticAgent;
