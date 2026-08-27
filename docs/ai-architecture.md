# SCOUT AI & Agent Architecture

This document describes the AI provider abstraction and agent foundation layout introduced in Phase 3A.

---

## 1. Overview

SCOUT separates agent logic from specific LLM provider SDK details. Agents communicate exclusively with an **AIProvider Interface**, ensuring that different providers (e.g. OpenAI, Anthropic, Gemini, Ollama) can be swapped in later without modifying any agent execution code.

Currently, **Groq Cloud** is implemented as the single active AI provider.

```text
  ┌──────────────────────────────────────────────────────────┐
  │                   Research Session                       │
  └───────────────────────────┬──────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 AgentExecutionService                    │
  └───────────────────────────┬──────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │                     AgentRegistry                        │
  └───────────────────────────┬──────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │                Agent (e.g. ResearchScout)                │
  └───────────────────────────┬──────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │                  AIProvider Interface                    │
  └───────────────────────────┬──────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │                      GroqProvider                        │
  └───────────────────────────┬──────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │                        Groq API                          │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables

Configure AI settings in the centralized root `.env` file:

```env
# ==========================================
# AI - GROQ
# ==========================================

# Required to run AI-backed agents:
GROQ_API_KEY=gsk_...

# Optional configs (will default if omitted):
AI_DEFAULT_PROVIDER=GROQ
AI_DEFAULT_MODEL=llama-3.3-70b-versatile
```

> [!NOTE]
> The SCOUT server boots successfully even when `GROQ_API_KEY` is not defined (useful for local offline testing). It only throws an execution error (`AI_PROVIDER_NOT_CONFIGURED`) when an AI-backed agent is actively called.

---

## 3. AI Provider Abstraction

### AIProvider Contract
Every AI integration must implement the [AIProvider](file:///d:/Scout/apps/api/src/providers/core/ai-provider.interface.ts) interface:

```typescript
export interface AIProvider {
  name: string;
  providerType: string;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}
```

- **`ProviderRequest`**: Houses token temperature limits, max tokens, system prompts, and a standardized array of `ProviderMessage` messages (`role: "system"|"user"|"assistant"`, `content: string`).
- **`ProviderResponse`**: Returns normalized generated text (`content`), actual `model` string, and standardized `TokenUsage` token stats.

### How to Add a Future Provider
To add a new provider (e.g., Anthropic):
1. Create a class `AnthropicProvider` implementing `AIProvider`.
2. Register the type `"ANTHROPIC"` inside the environment validator configuration.
3. Update `getAIProvider()` inside [`apps/api/src/providers/index.ts`](file:///d:/Scout/apps/api/src/providers/index.ts) to return the `AnthropicProvider` when selected.

---

## 4. Agent Foundation

Every SCOUT agent (Scout) implements the [Agent](file:///d:/Scout/apps/api/src/agents/core/agent.interface.ts) contract:

* **Properties**: `name`, `type`, `description`.
* **Execution method**: `execute(context: AgentContext): Promise<AgentResult>`.

### Key Components

1. **`BaseAgent`**: An abstract class providing subclasses structured, key-isolated helper methods to communicate with the `AIProvider`.
2. **`AgentRegistry`**: A central registry storing active agents. Example:
   ```typescript
   AgentRegistry.register(new EchoAgent());
   ```
3. **`AgentExecutionService`**: Resolves requested agent IDs, validates input queries, invokes execution cycles, and wraps errors into a unified `AgentResult` envelope.

---

## 5. Development Example Agents

Two example agents are included in development:
- **`EXAMPLE` (EchoAgent)**: Deterministic agent returning input queries immediately. Runs fully offline without any credentials.
- **`GROQ_TEST` (GroqTestAgent)**: Dispatches requests through the `AIProvider` to verify live model completions and connection latencies.
