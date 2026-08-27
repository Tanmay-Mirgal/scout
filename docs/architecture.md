# SCOUT Architecture

## Overview

SCOUT is designed as a modular, multi-agent research platform.

The system transforms a user's research question into a structured investigation workflow. Instead of relying on a single AI model to generate a response, SCOUT coordinates multiple specialized AI agents, called **Scouts**, to investigate different aspects of a problem.

The architecture is designed around five core principles:

* **Modularity** — components and Scouts should be independently maintainable.
* **Extensibility** — new Scouts, tools, and model providers can be added without redesigning the system.
* **Transparency** — research progress, evidence, and uncertainty should be visible to users.
* **Traceability** — important findings should be connected to supporting evidence.
* **Provider Independence** — the AI layer should not be tightly coupled to a single LLM provider.

---

# High-Level Architecture

```text
                                  ┌───────────────┐
                                  │     USER      │
                                  └───────┬───────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                                                                 │
│                    Next.js + TypeScript                         │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ Research   │ │ Agent      │ │ Evidence   │ │ Reports      │ │
│  │ Workspace  │ │ Timeline   │ │ Explorer   │ │ Dashboard    │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                              REST API
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                             │
│                                                                 │
│              Node.js + TypeScript + Fastify                     │
│                                                                 │
│  Authentication │ Research Sessions │ Reports │ User Management │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AGENT ORCHESTRATION ENGINE                    │
│                                                                 │
│  Query Analysis → Research Planning → Task Delegation           │
│                                                                 │
│  Agent Lifecycle → Workflow State → Result Aggregation          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
       ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
       │   Research   │   │     Data     │   │    Source    │
       │    Scout     │   │    Scout     │   │    Scout     │
       └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ EVIDENCE LAYER  │
                       └────────┬────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
             ┌──────────────┐        ┌──────────────┐
             │ Verification │        │    Critic    │
             │    Scout     │        │    Scout     │
             └──────┬───────┘        └──────┬───────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │    Synthesis    │
                       │      Scout      │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ RESEARCH REPORT │
                       └─────────────────┘
```

---

# System Flow

A SCOUT research session follows the lifecycle below:

```text
User Question
      │
      ▼
Query Analysis
      │
      ▼
Research Plan Generation
      │
      ▼
Task Decomposition
      │
      ▼
Scout Assignment
      │
      ▼
Parallel Investigation
      │
      ▼
Evidence Collection
      │
      ▼
Verification & Critique
      │
      ▼
Synthesis
      │
      ▼
Evidence-Backed Report
```

Each stage produces structured output that can be stored and used by subsequent stages.

---

# Frontend Layer

The frontend is responsible for providing a transparent interface into the research process.

### Stack

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui
* React Flow / XYFlow

### Primary Interfaces

#### Research Workspace

Users can:

* Submit research questions.
* Monitor research progress.
* View active Scouts.
* Inspect intermediate findings.

#### Agent Timeline

Displays the activity and lifecycle of each Scout.

Example:

```text
Research Started
      │
      ├── Research Scout ────── Completed
      │
      ├── Source Scout ──────── Completed
      │
      ├── Verification Scout ── Running
      │
      └── Critic Scout ──────── Waiting
```

#### Evidence Explorer

Allows users to navigate the relationship between:

* Claims
* Findings
* Sources
* Datasets
* Contradictions

#### Research Reports

Provides structured access to completed investigations and generated reports.

---

# Backend Layer

The backend acts as the central API and application layer.

### Stack

* Node.js
* TypeScript
* Fastify
* Zod (request and schema validation)
* Prisma ORM

### Responsibilities

* REST API — routes, request validation via Zod, and response serialization.
* Authentication and authorization.
* Research session management.
* Workflow state management.
* Agent orchestration.
* Task management.
* Report generation and persistence.
* Evidence management.
* Database integration via Prisma ORM.
* Redis integration for caching, queuing, and rate limiting.
* AI provider integration through an abstraction layer.

The backend remains independent from individual AI model implementations and coordinates agent execution through the Orchestration Engine.

### Conceptual Module Structure

The backend is organized into focused modules to maintain clear boundaries and support independent contribution.

```text
backend/
└── src/
    ├── config/             # Environment and application configuration
    ├── modules/
    │   ├── auth/           # Authentication and authorization
    │   ├── users/          # User management
    │   ├── research/       # Research session management
    │   ├── evidence/       # Evidence storage and retrieval
    │   └── reports/        # Report generation and persistence
    ├── agents/
    │   ├── orchestrator/   # Research workflow coordination
    │   ├── research/       # Research Scout implementation
    │   ├── data/           # Data Scout implementation
    │   ├── source/         # Source Scout implementation
    │   ├── verification/   # Verification Scout implementation
    │   ├── critic/         # Critic Scout implementation
    │   └── synthesis/      # Synthesis Scout implementation
    ├── services/           # Shared application services
    ├── providers/
    │   └── ai/             # AI provider abstraction layer
    ├── plugins/            # Fastify plugins (auth, db, redis)
    ├── lib/                # Shared utilities and helpers
    ├── middleware/         # Request middleware
    ├── types/              # Shared TypeScript types and interfaces
    ├── app.ts              # Fastify application setup
    └── server.ts           # Server entry point
```

This is a conceptual structure intended to guide architectural decisions. The actual implementation will evolve as the project develops.

---

# Agent Orchestration Engine

The Agent Orchestration Engine is the core intelligence layer of SCOUT.

Its responsibility is to coordinate the complete research workflow.

```text
                     USER QUERY
                          │
                          ▼
                  Query Analyzer
                          │
                          ▼
                    Orchestrator
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
        Research Plan              Task Queue
             │                         │
             └────────────┬────────────┘
                          │
                          ▼
                    AI SCOUTS
```

### Core Responsibilities

* Analyze the research question.
* Determine research complexity.
* Generate a research plan.
* Break the plan into tasks.
* Select appropriate Scouts.
* Track Scout execution.
* Handle failures and retries.
* Aggregate Scout results.
* Trigger verification and synthesis stages.

---

# The Scouts

## 🧭 Orchestrator

The Orchestrator coordinates the complete investigation.

Responsibilities:

* Understand the user's research goal.
* Generate a research plan.
* Create tasks.
* Assign tasks to Scouts.
* Monitor progress.
* Determine when additional investigation is required.

---

## 🔎 Research Scout

Responsible for broad topic investigation.

It explores:

* Core concepts.
* Relevant reports.
* Important developments.
* Different viewpoints.
* Key findings.

---

## 📊 Data Scout

Responsible for structured data analysis.

Potential responsibilities:

* Extract numerical data.
* Compare statistics.
* Identify trends.
* Generate data summaries.

---

## 🌐 Source Scout

Responsible for source discovery and evaluation.

It helps collect:

* Articles.
* Publications.
* Reports.
* Research papers.
* Official datasets.

Future versions may implement source-quality indicators and configurable trust policies.

---

## ✓ Verification Scout

Responsible for validating important claims.

Workflow:

```text
Claim
  │
  ▼
Find Supporting Evidence
  │
  ▼
Find Conflicting Evidence
  │
  ▼
Compare Sources
  │
  ▼
Verification Result
```

Possible results:

* Supported
* Partially Supported
* Conflicting Evidence
* Insufficient Evidence

---

## ⚖️ Critic Scout

The Critic Scout challenges findings before synthesis.

It investigates:

* Weak assumptions.
* Missing viewpoints.
* Logical inconsistencies.
* Potential bias.
* Alternative explanations.

This creates an adversarial review step within the research workflow.

---

## 🧩 Synthesis Scout

The Synthesis Scout combines validated findings into a structured report.

It should distinguish between:

* Strong evidence.
* Conflicting evidence.
* Uncertain findings.
* Reasoned conclusions.

The Synthesis Scout should not treat all findings as equally reliable.

---

# Evidence Layer

The Evidence Layer acts as the shared memory and knowledge foundation for a research session.

```text
Research Session
       │
       ▼
    Findings
       │
       ├── Claims
       │
       ├── Sources
       │
       ├── Evidence
       │
       ├── Data
       │
       └── Contradictions
```

Each evidence item should contain metadata such as:

* Source URL or identifier.
* Source type.
* Discovery timestamp.
* Scout that discovered it.
* Related claims.
* Verification status.

This structure enables evidence traceability throughout the system.

---

# AI Provider Layer

SCOUT uses an abstraction layer for LLM providers so that the rest of the system remains decoupled from any specific model or vendor.

```text
                    SCOUT AGENTS
                         │
                         ▼
                  LLM INTERFACE
                  (Provider Abstraction)
                         │
          ┌─────────────┬─────────────┐
          │             │             │
          ▼             ▼             ▼
        Gemini        OpenAI       Anthropic
                                       │
                                    Ollama
                               (Local Models)
```

This architecture allows different deployments to select:

* Cloud-hosted models.
* Self-hosted or local models via Ollama.
* Open-source models.
* Provider-specific APIs.

The rest of the SCOUT architecture remains unchanged regardless of which provider is active.

---

# Data Architecture

## PostgreSQL

Primary persistent storage for:

* Users.
* Research sessions.
* Research tasks.
* Agent execution history.
* Findings.
* Reports.
* Source metadata.

All database access goes through **Prisma ORM**, which provides type-safe queries, schema management, and database migrations.

## pgvector

A PostgreSQL extension used for vector storage and similarity operations.

Used for:

* Semantic search across research content.
* Document and evidence similarity search.
* Evidence retrieval based on conceptual relevance.
* Research context retrieval to support agent reasoning.

## Redis

Used for:

* Caching frequently accessed data.
* Temporary workflow state during active research sessions.
* Background job queuing for long-running Scout operations.
* Rate limiting for API and AI provider calls.

---

# Background Processing

Some Scout operations may take longer than a normal HTTP request.

For this reason, SCOUT should support asynchronous execution.

```text
User Request
      │
      ▼
Create Research Session
      │
      ▼
Create Research Tasks
      │
      ▼
Background Queue
      │
      ├── Research Scout
      ├── Source Scout
      ├── Data Scout
      │
      ▼
Store Results
      │
      ▼
Verification
      │
      ▼
Synthesis
```

Redis-backed queues are proposed for the initial implementation.

---

# Extensibility

A long-term goal of SCOUT is to support custom Scouts.

Conceptually:

```text
Scout Interface
      │
      ├── ResearchScout
      ├── DataScout
      ├── VerificationScout
      ├── CriticScout
      │
      └── CustomScout
              │
              ├── FinanceScout
              ├── LegalScout
              ├── ClimateScout
              └── AcademicScout
```

This allows the community to extend SCOUT with domain-specific capabilities.

---

# Deployment Architecture

Initial deployment will focus on a containerized environment.

```text
                    Internet
                       │
                       ▼
                Next.js Frontend
                       │
                       ▼
                  Fastify API
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      PostgreSQL      Redis      Agent Engine
                                      │
                                      ▼
                                  LLM Providers
```

Docker Compose will be used for local development.

Future infrastructure may support:

* Kubernetes.
* Cloud deployment.
* Self-hosted instances.
* Local-first AI configurations.

---

# Architecture Status

> 🚧 SCOUT is currently in the planning and early development phase.

This architecture represents the proposed system design and may evolve as the project is implemented and contributors provide feedback.

The immediate focus is to build a minimal but functional research workflow before introducing advanced features.
