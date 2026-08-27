import type { FastifyInstance } from "fastify";
import { AgentsTestController } from "./agents-test.controller";
import { AgentRegistry } from "../../agents/core/agent.registry";
import { EchoAgent } from "../../agents/examples/echo.agent";
import { GroqTestAgent } from "../../agents/examples/groq-test.agent";
import { OrchestratorAgent } from "../../agents/research/orchestrator.agent";
import { ResearchAgent } from "../../agents/research/research.agent";
import { SourceAgent } from "../../agents/research/source.agent";
import { EvidenceAgent } from "../../agents/research/evidence.agent";
import { ClaimAgent } from "../../agents/research/claim.agent";
import { CriticAgent } from "../../agents/research/critic.agent";
import { SynthesisAgent } from "../../agents/research/synthesis.agent";

// Register agents in AgentRegistry upon module loading
AgentRegistry.register(new EchoAgent());
AgentRegistry.register(new GroqTestAgent());
AgentRegistry.register(new OrchestratorAgent());
AgentRegistry.register(new ResearchAgent());
AgentRegistry.register(new SourceAgent());
AgentRegistry.register(new EvidenceAgent());
AgentRegistry.register(new ClaimAgent());
AgentRegistry.register(new CriticAgent());
AgentRegistry.register(new SynthesisAgent());

/**
 * Fastify route plugin for Agent testing endpoints.
 */
export async function agentsTestRoutes(app: FastifyInstance) {
  // POST /api/v1/agents/test
  app.post(
    "/agents/test",
    {
      schema: {
        description: "Execute a SCOUT agent context test query",
        tags: ["Agent Testing"],
        body: {
          type: "object",
          required: ["agentType", "query"],
          properties: {
            agentType: { type: "string" },
            query: { type: "string" },
            researchSessionId: { type: "string", format: "uuid" },
            researchTaskId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  output: { type: "string" },
                  usage: {
                    type: "object",
                    properties: {
                      inputTokens: { type: "integer" },
                      outputTokens: { type: "integer" },
                      totalTokens: { type: "integer" },
                    },
                  },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
    AgentsTestController.executeTest
  );
}
export default agentsTestRoutes;
