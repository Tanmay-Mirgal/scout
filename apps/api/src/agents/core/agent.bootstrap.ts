import { AgentRegistry } from "./agent.registry";
import { EchoAgent } from "../examples/echo.agent";
import { GroqTestAgent } from "../examples/groq-test.agent";
import { OrchestratorAgent } from "../research/orchestrator.agent";
import { ResearchAgent } from "../research/research.agent";
import { SourceAgent } from "../research/source.agent";
import { EvidenceAgent } from "../research/evidence.agent";
import { ClaimAgent } from "../research/claim.agent";
import { CriticAgent } from "../research/critic.agent";
import { SynthesisAgent } from "../research/synthesis.agent";

/**
 * Bootstrap function to register all SCOUT agents in the central AgentRegistry.
 * Must be executed during startup of both Fastify API server and background BullMQ workers.
 */
export function bootstrapAgents(): void {
  // Clear any previous registrations to prevent duplicates in dev/test watch mode
  AgentRegistry.clear();

  AgentRegistry.register(new EchoAgent());
  AgentRegistry.register(new GroqTestAgent());
  AgentRegistry.register(new OrchestratorAgent());
  AgentRegistry.register(new ResearchAgent());
  AgentRegistry.register(new SourceAgent());
  AgentRegistry.register(new EvidenceAgent());
  AgentRegistry.register(new ClaimAgent());
  AgentRegistry.register(new CriticAgent());
  AgentRegistry.register(new SynthesisAgent());

  console.log(`📡 Registered ${AgentRegistry.list().length} agents in AgentRegistry`);
}
