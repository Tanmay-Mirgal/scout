import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetAIProvider } from "../../providers";
import { env } from "../../config";
import {
  VerificationScout,
  verificationInputSchema,
  verificationResultSchema,
} from "../research/verification.agent";

// Mock the official Groq SDK
const mockChatCompletionsCreate = vi.fn();

vi.mock("groq-sdk", () => {
  return {
    Groq: vi.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: mockChatCompletionsCreate,
          },
        },
      };
    }),
  };
});

function mockStructuredResponse(payload: any) {
  mockChatCompletionsCreate.mockResolvedValue({
    choices: [
      {
        message: { content: JSON.stringify(payload) },
        finish_reason: "stop",
      },
    ],
    model: "llama-3.3-70b-versatile",
    usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
  });
}

const baseContext = {
  researchSessionId: "00000000-0000-0000-0000-000000000000",
  researchTaskId: "00000000-0000-0000-0000-000000000000",
  query: "Are flow batteries viable for grid storage?",
};

const validInput = {
  claims: [
    { content: "Flow batteries have a round-trip efficiency of 65-75%", status: "SUPPORTED" },
    { content: "Flow batteries last over 20 years", status: "UNVERIFIED" },
    { content: "Flow batteries are cheaper than lithium-ion per kWh", status: "UNVERIFIED" },
  ],
  sources: [
    { title: "DOE Storage Report 2024", publisher: "US DOE", credibilityScore: 0.95, evidence: [{ content: "DOE reports 65-75% round-trip efficiency." }] },
    { title: "Random blog post", publisher: null, credibilityScore: 0.3, evidence: [{ content: "Anecdotal lifespan claim." }] },
  ],
};

const validOutput = {
  verifiedClaims: [
    {
      claimIndex: 0,
      confidenceScore: 0.92,
      reasoning: "Corroborated by the DOE storage report",
      supportingSourceIndexes: [0],
    },
  ],
  unsupportedClaims: [
    {
      claimIndex: 2,
      reasoning: "No credible source confirms the cost claim",
    },
  ],
  contradictions: [
    {
      topic: "Flow battery lifespan",
      explanation: "Claims disagree on expected operational lifespan",
      claimIndexes: [1],
    },
  ],
};

describe("Verification Scout", () => {
  const originalApiKey = env.GROQ_API_KEY;
  const originalMaxRetries = env.RESEARCH_AI_MAX_RETRIES;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAIProvider();
    env.GROQ_API_KEY = "gsk_mock_api_key_for_testing";
    // Keep failure-path tests fast by skipping retry backoff loops
    env.RESEARCH_AI_MAX_RETRIES = 1;
  });

  afterEach(() => {
    env.GROQ_API_KEY = originalApiKey;
    env.RESEARCH_AI_MAX_RETRIES = originalMaxRetries;
  });

  // ===========================================================================
  // SCHEMA VALIDATION
  // ===========================================================================
  describe("verificationResultSchema", () => {
    it("should accept a well-formed verification payload", () => {
      const parsed = verificationResultSchema.safeParse(validOutput);
      expect(parsed.success).toBe(true);
    });

    it("should reject payloads missing required verification fields", () => {
      const parsed = verificationResultSchema.safeParse({
        verifiedClaims: [{ claimIndex: 0 }], // missing confidenceScore and reasoning
        unsupportedClaims: [],
        contradictions: [],
      });
      expect(parsed.success).toBe(false);
    });

    it("should reject out-of-range confidence scores", () => {
      const parsed = verificationResultSchema.safeParse({
        ...validOutput,
        verifiedClaims: [
          { claimIndex: 0, confidenceScore: 1.5, reasoning: "too confident", supportingSourceIndexes: [] },
        ],
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("verificationInputSchema", () => {
    it("should accept claims and sources from the research phase", () => {
      const parsed = verificationInputSchema.safeParse(validInput);
      expect(parsed.success).toBe(true);
    });

    it("should reject claims without content", () => {
      const parsed = verificationInputSchema.safeParse({
        claims: [{ status: "UNVERIFIED" }],
        sources: [],
      });
      expect(parsed.success).toBe(false);
    });
  });

  // ===========================================================================
  // AGENT EXECUTION
  // ===========================================================================
  describe("execute", () => {
    it("should return an empty verification result when there are no claims, without calling the provider", async () => {
      const scout = new VerificationScout();
      const result = await scout.execute({
        ...baseContext,
        context: JSON.stringify({ claims: [], sources: [] }),
      });

      expect(result.success).toBe(true);
      expect(JSON.parse(result.output)).toEqual({
        verifiedClaims: [],
        unsupportedClaims: [],
        contradictions: [],
      });
      expect(result.metadata).toEqual({
        verifiedCount: 0,
        unsupportedCount: 0,
        contradictionCount: 0,
      });
      expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
    });

    it("should fail cleanly when the context is not valid JSON", async () => {
      const scout = new VerificationScout();
      const result = await scout.execute({ ...baseContext, context: "not json at all" });

      expect(result.success).toBe(false);
      expect(result.metadata?.code).toBe("INVALID_VERIFICATION_INPUT");
    });

    it("should fail cleanly when the context fails input schema validation", async () => {
      const scout = new VerificationScout();
      const result = await scout.execute({
        ...baseContext,
        context: JSON.stringify({ claims: [{ status: "UNVERIFIED" }], sources: [] }),
      });

      expect(result.success).toBe(false);
      expect(result.metadata?.code).toBe("INVALID_VERIFICATION_INPUT");
    });

    it("should parse a valid structured verification response", async () => {
      mockStructuredResponse(validOutput);

      const scout = new VerificationScout();
      const result = await scout.execute({
        ...baseContext,
        context: JSON.stringify(validInput),
      });

      expect(result.success).toBe(true);
      const output = JSON.parse(result.output);
      expect(output.verifiedClaims).toHaveLength(1);
      expect(output.verifiedClaims[0].claimIndex).toBe(0);
      expect(output.unsupportedClaims).toHaveLength(1);
      expect(output.contradictions).toHaveLength(1);
      expect(result.metadata).toEqual({
        verifiedCount: 1,
        unsupportedCount: 1,
        contradictionCount: 1,
      });
    });

    it("should drop out-of-range claim and source indexes from the output", async () => {
      mockStructuredResponse({
        verifiedClaims: [
          { claimIndex: 99, confidenceScore: 0.9, reasoning: "hallucinated index", supportingSourceIndexes: [42] },
        ],
        unsupportedClaims: [],
        contradictions: [],
      });

      const scout = new VerificationScout();
      const result = await scout.execute({
        ...baseContext,
        context: JSON.stringify(validInput),
      });

      expect(result.success).toBe(true);
      const output = JSON.parse(result.output);
      expect(output.verifiedClaims).toHaveLength(0);
    });


    it("should reject verified claims without a valid evidence-backed source", async () => {
      mockStructuredResponse({
        verifiedClaims: [
          { claimIndex: 0, confidenceScore: 0.9, reasoning: "unsupported", supportingSourceIndexes: [99] },
        ],
        unsupportedClaims: [],
        contradictions: [],
      });

      const scout = new VerificationScout();
      const result = await scout.execute({
        ...baseContext,
        context: JSON.stringify(validInput),
      });

      expect(result.success).toBe(true);
      const output = JSON.parse(result.output);
      expect(output.verifiedClaims).toEqual([]);
      expect(output.unsupportedClaims).toEqual([{ claimIndex: 0, reasoning: "No valid evidence-backed source was provided for this claim." }]);
      expect(result.metadata?.verifiedCount).toBe(0);
    });

    it("should not let a claim be both verified and unsupported", async () => {
      mockStructuredResponse({
        verifiedClaims: [
          { claimIndex: 0, confidenceScore: 0.9, reasoning: "corroborated", supportingSourceIndexes: [0] },
        ],
        unsupportedClaims: [{ claimIndex: 0, reasoning: "also flagged" }],
        contradictions: [],
      });

      const scout = new VerificationScout();
      const result = await scout.execute({
        ...baseContext,
        context: JSON.stringify(validInput),
      });

      expect(result.success).toBe(true);
      const output = JSON.parse(result.output);
      expect(output.verifiedClaims).toHaveLength(1);
      expect(output.unsupportedClaims).toHaveLength(0);
    });

    it("should return a failure result when the provider cannot produce valid output", async () => {
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: "definitely not json" }, finish_reason: "stop" }],
        model: "llama-3.3-70b-versatile",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });

      const scout = new VerificationScout();
      const result = await scout.execute({
        ...baseContext,
        context: JSON.stringify(validInput),
      });

      expect(result.success).toBe(false);
      expect(result.metadata?.code).toBe("AI_GENERATION_FAILED");
      expect(result.error).toContain("Verification Scout validation failed");
    });
  });
});
