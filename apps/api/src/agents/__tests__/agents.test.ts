import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAIProvider, resetAIProvider } from "../../providers";
import { GroqProvider } from "../../providers/groq/groq.provider";
import { AgentRegistry } from "../core/agent.registry";
import { AgentExecutionService } from "../core/agent-execution.service";
import { EchoAgent } from "../examples/echo.agent";
import { GroqTestAgent } from "../examples/groq-test.agent";
import { buildApp } from "../../app";
import { env } from "../../config";

// Mock the official Groq SDK
const mockChatCompletionsCreate = vi.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: "Mocked Groq response content",
      },
      finish_reason: "stop",
    },
  ],
  model: "llama-3.3-70b-versatile",
  usage: {
    prompt_tokens: 10,
    completion_tokens: 15,
    total_tokens: 25,
  },
});

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

// Mock database and Redis clients to prevent external networking
vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    researchSession: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../lib/redis", () => ({
  redis: {
    status: "ready",
    ping: vi.fn().mockResolvedValue("PONG"),
    on: vi.fn(),
  },
}));

describe("SCOUT AI Provider & Agent Foundation Tests", () => {
  const originalApiKey = env.GROQ_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    AgentRegistry.clear();
    resetAIProvider();
    // Restore default mock key
    env.GROQ_API_KEY = "gsk_mock_api_key_for_testing";
  });

  afterEach(() => {
    env.GROQ_API_KEY = originalApiKey;
  });

  // ===========================================================================
  // 1. AI PROVIDER ABSTRACTION TESTS
  // ===========================================================================
  describe("AIProvider & GroqProvider", () => {
    it("should instantiate getAIProvider cleanly as GroqProvider", () => {
      const provider = getAIProvider();
      expect(provider).toBeInstanceOf(GroqProvider);
      expect(provider.name).toBe("Groq AI Provider");
      expect(provider.providerType).toBe("GROQ");
    });

    it("should generate a response successfully via Groq mock SDK", async () => {
      const provider = getAIProvider();
      const response = await provider.generate({
        messages: [{ role: "user", content: "Hello" }],
        systemPrompt: "You are a test helper",
      });

      expect(response.content).toBe("Mocked Groq response content");
      expect(response.provider).toBe("GROQ");
      expect(response.usage).toEqual({
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
      });
      expect(mockChatCompletionsCreate).toHaveBeenCalled();
    });

    it("should throw AI_PROVIDER_NOT_CONFIGURED error when GROQ_API_KEY is missing", async () => {
      // Simulate missing API key
      env.GROQ_API_KEY = "";

      const provider = new GroqProvider();
      await expect(
        provider.generate({
          messages: [{ role: "user", content: "Hello" }],
        })
      ).rejects.toThrowError(/not configured/);

      try {
        await provider.generate({
          messages: [{ role: "user", content: "Hello" }],
        });
      } catch (err: any) {
        expect(err.code).toBe("AI_PROVIDER_NOT_CONFIGURED");
      }
    });

    it("should allow application startup without GROQ_API_KEY", async () => {
      env.GROQ_API_KEY = "";
      
      // Attempt to boot app
      const app = await buildApp();
      expect(app).toBeDefined();
      
      // Health check should still work even without the key
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });
      expect(response.statusCode).toBe(200);
    });
  });

  // ===========================================================================
  // 2. AGENT REGISTRY TESTS
  // ===========================================================================
  describe("AgentRegistry", () => {
    it("should register and retrieve agents successfully", () => {
      const echoAgent = new EchoAgent();
      AgentRegistry.register(echoAgent);

      const retrieved = AgentRegistry.get("EXAMPLE");
      expect(retrieved).toBe(echoAgent);
      expect(AgentRegistry.list()).toContain(echoAgent);
    });

    it("should throw AGENT_NOT_FOUND error when retrieving non-existent agent", () => {
      expect(() => AgentRegistry.get("NOT_REAL")).toThrowError(/not found/);
      try {
        AgentRegistry.get("NOT_REAL");
      } catch (err: any) {
        expect(err.code).toBe("AGENT_NOT_FOUND");
      }
    });
  });

  // ===========================================================================
  // 3. ECHO AGENT & EXECUTION TESTS
  // ===========================================================================
  describe("EchoAgent & Execution Service", () => {
    it("should execute EchoAgent successfully offline without credentials", async () => {
      // Simulate missing key
      env.GROQ_API_KEY = "";

      const echoAgent = new EchoAgent();
      AgentRegistry.register(echoAgent);

      const context = {
        researchSessionId: "00000000-0000-0000-0000-000000000000",
        researchTaskId: "00000000-0000-0000-0000-000000000000",
        query: "Verify Echo Agent",
      };

      const result = await AgentExecutionService.execute("EXAMPLE", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Echo: Verify Echo Agent");
      expect(result.error).toBeUndefined();
    });

    it("should return standard error result when agent type is missing", async () => {
      const context = {
        researchSessionId: "00000000-0000-0000-0000-000000000000",
        researchTaskId: "00000000-0000-0000-0000-000000000000",
        query: "Will fail",
      };

      const result = await AgentExecutionService.execute("MISSING_AGENT_TYPE", context);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
      expect(result.metadata?.code).toBe("AGENT_NOT_FOUND");
    });
  });

  // ===========================================================================
  // 4. API ROUTE TEST FOR AGENTS
  // ===========================================================================
  describe("POST /api/v1/agents/test Endpoint", () => {
    it("should execute EXAMPLE EchoAgent successfully via POST", async () => {
      AgentRegistry.register(new EchoAgent());
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/agents/test",
        payload: {
          agentType: "EXAMPLE",
          query: "Test Route",
        },
      });

      expect(response.statusCode).toBe(200);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(true);
      expect(res.data.output).toBe("Echo: Test Route");
    });

    it("should return 424 status code when executing GROQ_TEST without GROQ_API_KEY", async () => {
      env.GROQ_API_KEY = ""; // clear key
      AgentRegistry.register(new GroqTestAgent());
      const app = await buildApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/agents/test",
        payload: {
          agentType: "GROQ_TEST",
          query: "Test Key Failure",
        },
      });

      expect(response.statusCode).toBe(424);
      const res = JSON.parse(response.body);
      expect(res.success).toBe(false);
      expect(res.error.code).toBe("AI_PROVIDER_NOT_CONFIGURED");
    });
  });
});
