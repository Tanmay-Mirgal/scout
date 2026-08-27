# Contributing to SCOUT

First off, thank you for considering contributing to **SCOUT**! 🚀

SCOUT is an open-source, multi-agent research and intelligence platform focused on making AI-assisted research more transparent, evidence-aware, and collaborative.

We welcome contributors from different backgrounds, including:

- Frontend Development
- Backend Development
- AI & Agent Systems
- Data Engineering
- DevOps
- Testing
- Documentation
- UI/UX Design

You don't need to be an expert to contribute. There will be tasks suitable for both beginners and experienced open-source contributors.

---

# 🚀 Getting Started

Before making a contribution, please:

1. Read the [README](./README.md)
2. Understand the [Architecture](./docs/architecture.md)
3. Check the [Roadmap](./docs/roadmap.md)
4. Explore open GitHub Issues
5. Look for issues labeled `good first issue` or `help wanted`

If you're new to open source, starting with documentation, setup, testing, or beginner-friendly issues is highly recommended.

---

# 🐛 Finding an Issue

Before starting work, check the existing issues.

You can look for labels such as:

- `good first issue` — Beginner-friendly tasks
- `help wanted` — Community contributions needed
- `frontend`
- `backend`
- `ai`
- `agents`
- `documentation`
- `devops`
- `bug`
- `enhancement`

If you find an issue you would like to work on, leave a comment indicating that you would like to take it.

Example:

> Hi! I'd like to work on this issue. Could you please assign it to me?

Please wait for confirmation before beginning work on larger issues to avoid duplicate efforts.

---

# 💡 Suggesting a Feature

Have an idea that could improve SCOUT?

Before opening a feature request:

1. Check whether a similar issue already exists.
2. Review the project roadmap.
3. Clearly explain the problem your feature solves.
4. Describe your proposed solution.
5. Mention possible alternatives if applicable.

A good feature request focuses on the **problem first**, not only the implementation.

---

# 🛠 Development Workflow

## 1. Fork the Repository

Fork the SCOUT repository to your own GitHub account.

## 2. Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/scout.git
cd scout
```

## 3. Create a Branch

Create a descriptive branch for your work.

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-description
```

## 4. Make Your Changes

Follow the relevant coding standards described in this guide.

## 5. Commit Your Changes

Write clear, descriptive commit messages.

```bash
git add .
git commit -m "feat: add research session status tracking"
```

## 6. Push and Open a Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request against the `main` branch of the SCOUT repository.

---

# 📋 Coding Standards

## General

- Keep contributions focused and modular.
- Avoid large, sweeping changes across many files in a single PR.
- Write clear, self-explanatory code with comments where necessary.
- Ensure new code does not break existing functionality.

---

## TypeScript

SCOUT uses **TypeScript** across both the frontend and backend.

- Use TypeScript strictly. Avoid `any` unless absolutely unavoidable.
- Define explicit types and interfaces for all data structures.
- Use `unknown` instead of `any` for genuinely unknown types.
- Prefer `type` aliases for simple shapes and `interface` for extensible contracts.
- Enable and respect `strict` mode settings.

---

## Backend — Node.js + Fastify

The backend is built with **Node.js**, **TypeScript**, and **Fastify**.

### Route Handlers

- Keep Fastify route handlers lightweight.
- Route handlers should handle request parsing and response formatting only.
- Delegate all business logic to service modules.

### Validation

- Use **Zod** for all request and input validation.
- Define Zod schemas for route inputs, query parameters, and request bodies.
- Never trust raw input without validation.

### Services and Modules

- Place business logic in service files within the appropriate module.
- Maintain clear module boundaries.
- Each module should own its own routes, services, and types.

```text
backend/src/modules/
├── auth/
├── users/
├── research/
├── evidence/
└── reports/
```

### Error Handling

- Handle errors consistently using centralized error handling middleware.
- Avoid swallowing errors silently.
- Return meaningful, structured error responses.

### Async/Await

- Always use `async/await` correctly.
- Always handle promise rejections.
- Avoid mixing callbacks with promises.

### Database

- Use **Prisma ORM** for all database access.
- Avoid raw SQL queries unless absolutely necessary and clearly documented.
- Keep Prisma schema changes in dedicated migration files.

---

## Frontend — Next.js

The frontend is built with **Next.js** and **TypeScript**.

- Use components and hooks to keep code reusable.
- Use **Tailwind CSS** utility classes for styling.
- Use **shadcn/ui** components where applicable.
- Use **React Flow / XYFlow** for agent workflow and graph visualization.
- Avoid hardcoding API URLs. Use environment variables.

---

## Testing

- Write tests for important business logic and API endpoints.
- Use meaningful test names that describe the expected behavior.
- Keep tests focused. Unit tests should test one behavior at a time.
- Integration tests should cover key API flows.
- Do not merge untested critical paths.

---

## Linting and Formatting

- Follow the existing ESLint and Prettier configuration.
- Run the linter before submitting a PR.
- Do not disable lint rules without justification.

---

# 📝 Pull Request Guidelines

When submitting a Pull Request:

1. Fill out the Pull Request template completely.
2. Link the relevant GitHub Issue.
3. Describe what changed and why.
4. Describe how you tested the change.
5. Keep PRs focused. One concern per PR.
6. Be responsive to review feedback.

---

# 🤝 Code Review

SCOUT aims for constructive, respectful code review.

When reviewing:

- Focus on the code, not the author.
- Explain the reasoning behind requested changes.
- Acknowledge good work and learning opportunities.

When receiving feedback:

- Take feedback professionally.
- Ask questions if a comment is unclear.
- Update the PR based on agreed-upon changes.

---

# 📖 Documentation

Documentation contributions are highly valued.

If you improve or add documentation:

- Keep language clear, concise, and accurate.
- Do not describe planned features as implemented.
- Keep architecture diagrams consistent with the actual codebase.
- Follow the existing document structure.

---

# 🌱 First-Time Contributors

If this is your first open-source contribution, welcome!

Recommended starting points:

- Documentation improvements.
- Fixing typos or clarifying explanations.
- Issues labeled `good first issue`.
- Adding or improving test coverage.

If you have questions, open a Discussion on GitHub or ask in the relevant issue thread.

---

# 📜 Code of Conduct

All contributors are expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

Be respectful, constructive, and collaborative.

---

## 🔎 SCOUT

### **Ask. Investigate. Verify. Understand.**

**One question. Multiple AI Scouts. Evidence-backed intelligence.**
