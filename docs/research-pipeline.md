# SCOUT Research Intelligence Pipeline

This document details the modular research intelligence pipeline implemented in Phase 3B-3F.

---

## 1. Complete Research Flow Diagram

The research intelligence pipeline processes queries from user questions down to verified, evidence-backed claims:

```text
User creates ResearchSession (DRAFT)
         │
         ▼
POST /research-sessions/:id/plan
         │
         ├──► OrchestratorAgent (ORCHESTRATOR) ──► structured task list
         ▼
Tasks stored as PENDING (Session Status ➔ QUEUED)
         │
         ▼
POST /research-sessions/:id/execute
         │
         ▼ (Sequential Task Loop)
For each Task (Task Status ➔ IN_PROGRESS):
         │
         ├──► ResearchAgent (RESEARCH) ──► generate queries
         │       │
         │       ▼ (Search Query Loop)
         │    SearchProvider (Tavily) ──► web search results (snippets, raw HTML)
         │       │
         │       ▼ (Candidate Result Loop)
         │    SourceAgent (SOURCE) ──► domain analysis, credibility score (0-1)
         │       │
         │       ├─► (If Relevant)
         │       │   ContentFetcher ──► extracts cleaned plain text from web page
         │       │   EvidenceAgent (DATA) ──► extracts facts, stats, locations
         │       │   ClaimAgent (SYNTHESIS) ──► synthesizes key claims (UNVERIFIED)
         │       │
         │       ▼ (Critic Verification Phase)
         ├──► CriticAgent (CRITIC) ──► maps ClaimEvidence links (SUPPORTS, CONTRADICTS)
         │                             evaluates overall claim status
         │
         ▼
Task Status ➔ COMPLETED (or FAILED)
         │
         ▼ (Post Loop Summary)
Session Status ➔ COMPLETED (Session completed statistics returned)
```

---

## 2. Agent Responsibilities

| Agent Type | DB AgentType | Class Name | Responsibilities |
| :--- | :--- | :--- | :--- |
| **`ORCHESTRATOR`** | `ORCHESTRATOR` | `OrchestratorAgent` | Analyzes session queries, builds structured task plans, sets task priorities. |
| **`RESEARCH`** | `RESEARCH` | `ResearchAgent` | Generates search queries and gathers candidate search results. |
| **`SOURCE`** | `SOURCE` | `SourceAgent` | Checks domain types, estimates source credibility scores, rejects spam. |
| **`EVIDENCE`** | `DATA` | `EvidenceAgent` | Extracts key fact extracts, statistics, and source locations from raw webpage text. |
| **`CLAIM`** | `SYNTHESIS` | `ClaimAgent` | Synthesizes claims raised by extracted evidence facts. |
| **`CRITIC`** | `CRITIC` | `CriticAgent` | Assesses claims against evidence facts, maps relationships, updates verified statuses. |

---

## 3. Caching (Redis)

SCOUT implements double-sided caching in Redis to prevent excessive third-party query charges and increase execution speeds:
- **Search Queries**: Cached under key `search:<query>` for **1 hour**.
- **Page Contents**: Crawled page texts are cached under `content:<url>` for **1 day**.

---

## 4. Safety Execution Limits

Safety parameters are configured in the centralized root `.env` file:

- `RESEARCH_MAX_TASKS_PER_EXECUTION` (default: `5`): Maximum tasks scheduled per execution trigger.
- `RESEARCH_MAX_SEARCH_QUERIES_PER_TASK` (default: `3`): Clamp queries generated per task.
- `RESEARCH_MAX_RESULTS_PER_QUERY` (default: `5`): Clamp search results retrieved per query.
- `RESEARCH_MAX_SOURCES_PER_TASK` (default: `5`): Clamp sources evaluated per task.
- `RESEARCH_MAX_SOURCE_CONTENT_SIZE` (default: `100000` bytes): Clamp fetched text size.
- `RESEARCH_REQUEST_TIMEOUT_MS` (default: `60000` ms): Web crawl fetch request timeout.
- `RESEARCH_AI_MAX_RETRIES` (default: `3`): JSON mode retry limit before failure.

---

## 5. Database Integration

- **`ResearchSession`**: The root of the query session. Transitions through `DRAFT` ➔ `QUEUED` ➔ `IN_PROGRESS` ➔ `COMPLETED` / `FAILED`.
- **`ResearchTask`**: Tasks planned by the Orchestrator. Initially `PENDING`, transitions to `IN_PROGRESS` and `COMPLETED` / `FAILED` sequentially.
- **`AgentRun`**: Tracks agent operations, recording input arguments, parsed JSON output, error traces, and runtime duration.
- **`Source`**: Stores accepted domains, publishers, accessed timestamps, URLs (normalized for deduplication), and credibility scores.
- **`Evidence`**: Excerpts extracted from webpage text, maintaining trace links to the parent `Source`.
- **`Claim`**: Factual assertions synthesized from evidence. Verified by `CriticAgent` as `SUPPORTED`, `CONTRADICTED`, or `INSUFFICIENT_EVIDENCE`.
- **`ClaimEvidence`**: Many-to-many relation table mapping claim-to-evidence mappings (`SUPPORTS` | `CONTRADICTS` | `RELATES_TO`) and relationship weights.

---

## 6. How Contributors Can Extend the Platform

### Adding a New Agent
1. Create a class extending `BaseAgent` inside `apps/api/src/agents/research/`.
2. Register the agent inside `apps/api/src/modules/agents/agents-test.routes.ts`:
   ```typescript
   AgentRegistry.register(new MyNewAgent());
   ```
3. Update the `agentTypeMap` inside `apps/api/src/services/research-execution.service.ts` if mapping to an existing DB `AgentType` enum, or append to `AgentType` inside `prisma/schema.prisma` and run migration scripts.

### Adding a Future Search Provider
1. Create a class implementing the `SearchProvider` contract:
   ```typescript
   export interface SearchProvider {
     search(query: string, options?: { limit?: number }): Promise<SearchResponse>;
   }
   ```
2. Update the factory helper `getSearchProvider()` inside `apps/api/src/providers/search/index.ts` to instantiate and return your new search class when selected via configuration environment variables.
