import { z } from "zod";
import { BaseAgent } from "../core/base.agent";
import type { AgentContext, AgentResult } from "../core/agent.types";

// Input schema for the claims and source lists handed over from the research phase
export const verificationInputSchema = z.object({
  claims: z.array(
    z.object({
      content: z.string({ required_error: "Claim content is required." }),
      status: z.string().optional(),
      reasoning: z.string().nullable().optional(),
    })
  ),
  sources: z.array(
    z.object({
      title: z.string({ required_error: "Source title is required." }),
      url: z.string().optional(),
      publisher: z.string().nullable().optional(),
      credibilityScore: z.number().min(0).max(1).optional(),
      evidence: z.array(
        z.object({
          content: z.string({ required_error: "Evidence content is required." }),
          summary: z.string().nullable().optional(),
        })
      ).default([]),
    })
  ).default([]),
});

// Output schema for the cross-source claim verification payload
export const verificationResultSchema = z.object({
  verifiedClaims: z.array(
    z.object({
      claimIndex: z.number(), // Mapped to the index of the claim in the input list
      confidenceScore: z.number().min(0).max(1),
      reasoning: z.string({ required_error: "Verification reasoning is required." }),
      supportingSourceIndexes: z.array(z.number()).optional(),
    })
  ),
  unsupportedClaims: z.array(
    z.object({
      claimIndex: z.number(),
      reasoning: z.string({ required_error: "Rejection reasoning is required." }),
    })
  ),
  contradictions: z.array(
    z.object({
      topic: z.string({ required_error: "Contradiction topic is required." }),
      explanation: z.string({ required_error: "Contradiction explanation is required." }),
      claimIndexes: z.array(z.number()).optional(),
    })
  ),
});

// Strict output shape after index sanitization
export interface VerificationResult {
  verifiedClaims: {
    claimIndex: number;
    confidenceScore: number;
    reasoning: string;
    supportingSourceIndexes: number[];
  }[];
  unsupportedClaims: {
    claimIndex: number;
    reasoning: string;
  }[];
  contradictions: {
    topic: string;
    explanation: string;
    claimIndexes: number[];
  }[];
}

/**
 * Verification Scout responsible for evaluating claim consistency across all
 * gathered sources before final report synthesis. Splits claims into verified
 * and unsupported buckets and surfaces cross-source contradictions.
 */
export class VerificationScout extends BaseAgent {
  readonly name = "Verification Scout";
  readonly type = "VERIFICATION";
  readonly description = "Validates research claims across sources and flags unsupported or contradictory findings.";

  async execute(context: AgentContext): Promise<AgentResult> {
    const provider = this.getProvider();
    const inputJson = context.context || "";

    let claims: z.infer<typeof verificationInputSchema>["claims"] = [];
    let sources: z.infer<typeof verificationInputSchema>["sources"] = [];

    try {
      const parsed = JSON.parse(inputJson);
      const validated = verificationInputSchema.safeParse(parsed);
      if (!validated.success) {
        return {
          success: false,
          output: "",
          error: `Verification input failed schema validation: ${validated.error.message}`,
          metadata: { code: "INVALID_VERIFICATION_INPUT" },
        };
      }
      claims = validated.data.claims;
      sources = validated.data.sources;
    } catch {
      return {
        success: false,
        output: "",
        error: "Verification context input must be a valid JSON string.",
        metadata: { code: "INVALID_VERIFICATION_INPUT" },
      };
    }

    if (claims.length === 0) {
      return {
        success: true,
        output: JSON.stringify({
          verifiedClaims: [],
          unsupportedClaims: [],
          contradictions: [],
        }),
        metadata: { verifiedCount: 0, unsupportedCount: 0, contradictionCount: 0 },
      };
    }

    const systemPrompt = `You are the SCOUT Verification Scout.
Your goal is to evaluate the consistency of research claims across all collected sources before final report synthesis.
For each claim, cross-check it against the source list and the other claims:
- A claim is VERIFIED only when it is consistent with the evidence and corroborated by credible sources.
- A claim is UNSUPPORTED when no credible source backs it, or it conflicts with stronger findings.
- Flag CONTRADICTIONS whenever two or more claims (or sources) make conflicting statements about the same topic.
Be highly conservative! Do not verify claims backed by weak or single uncorroborated sources.
Reference claims and sources only by their index in the provided lists.
Your output MUST be a valid JSON object strictly matching the schema format:
{
  "verifiedClaims": [
    {
      "claimIndex": 0,
      "confidenceScore": 0.9,
      "reasoning": "Why the claim holds up across sources",
      "supportingSourceIndexes": [0, 2]
    }
  ],
  "unsupportedClaims": [
    {
      "claimIndex": 1,
      "reasoning": "Why the claim cannot be verified"
    }
  ],
  "contradictions": [
    {
      "topic": "Topic the claims disagree on",
      "explanation": "What the conflicting statements are",
      "claimIndexes": [0, 3]
    }
  ]
}`;

    const userPrompt = `Research Objective: "${context.query}"

Claims to Verify:
${JSON.stringify(
  claims.map((c, index) => ({
    index,
    content: c.content,
    status: c.status,
    reasoning: c.reasoning,
  })),
  null,
  2
)}

Collected Sources:
${JSON.stringify(
  sources.map((s, index) => ({
    index,
    title: s.title,
    url: s.url,
    publisher: s.publisher,
    credibilityScore: s.credibilityScore,
    evidence: s.evidence,
  })),
  null,
  2
)}`;

    try {
      const result = await provider.generateStructured(
        {
          messages: [{ role: "user", content: userPrompt }],
          systemPrompt,
          temperature: 0.1,
        },
        verificationResultSchema
      );

      // Sanitize hallucinated indexes so downstream steps can trust the payload
      const inRange = (i: number) => i >= 0 && i < claims.length;
      const sourceInRange = (i: number) => i >= 0 && i < sources.length;

      const sanitizedCandidates = result.verifiedClaims
        .filter((v) => inRange(v.claimIndex))
        .map((v) => ({
          ...v,
          supportingSourceIndexes: [...new Set(
            (v.supportingSourceIndexes ?? []).filter(
              (index) => sourceInRange(index) && sources[index].evidence.length > 0
            )
          )],
        }));
      // A claim is only verified when at least one valid source has evidence content.
      const verifiedClaims = sanitizedCandidates.filter((v) => v.supportingSourceIndexes.length > 0);
      const verifiedIndexes = new Set(verifiedClaims.map((v) => v.claimIndex));
      const rejectedVerifiedClaims = sanitizedCandidates
        .filter((v) => v.supportingSourceIndexes.length === 0)
        .map((v) => ({
          claimIndex: v.claimIndex,
          reasoning: "No valid evidence-backed source was provided for this claim.",
        }));

      // A claim cannot be both verified and unsupported; verified wins.
      const unsupportedByIndex = new Map<number, { claimIndex: number; reasoning: string }>();
      for (const unsupported of [...result.unsupportedClaims, ...rejectedVerifiedClaims]) {
        if (inRange(unsupported.claimIndex) && !verifiedIndexes.has(unsupported.claimIndex)) {
          unsupportedByIndex.set(unsupported.claimIndex, unsupported);
        }
      }
      const unsupportedClaims = [...unsupportedByIndex.values()];

      const contradictions = result.contradictions.map((c) => ({
        ...c,
        claimIndexes: (c.claimIndexes ?? []).filter(inRange),
      }));

      const sanitized: VerificationResult = {
        verifiedClaims,
        unsupportedClaims,
        contradictions,
      };

      return {
        success: true,
        output: JSON.stringify(sanitized),
        metadata: {
          verifiedCount: verifiedClaims.length,
          unsupportedCount: unsupportedClaims.length,
          contradictionCount: contradictions.length,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        output: "",
        error: `Verification Scout validation failed: ${err.message}`,
        metadata: {
          code: err.code || "VERIFICATION_FAILED",
        },
      };
    }
  }
}
export default VerificationScout;
