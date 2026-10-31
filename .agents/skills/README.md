# DengueSense Agent Skills Suite

Welcome to the **DengueSense Agent Skills Suite**. This directory contains modular, portable, and production-grade domain skills designed according to the **Open Agent Skills Standard Specification** ([agentskills.io](https://agentskills.io)), fully compatible with **Google Antigravity**, **Claude Code**, **OpenAI CodeX**, **Cursor**, and other agentic pair-programming frameworks.

---

## 1. Architectural Philosophy: Progressive Disclosure

Traditional agent setups suffer from context-window bloat when large system prompts or entire runbooks are injected unconditionally. The DengueSense Skills Suite employs a **3-tier progressive disclosure model**:

1. **Discovery (Index Phase)**: At agent startup, only the YAML frontmatter (`name` and `description`) is scanned (~100 tokens per skill).
2. **Activation (Trigger Phase)**: When an agent detects that a user request matches a skill's description, it reads the full `SKILL.md` into active memory.
3. **Execution & Resource Access (On-Demand)**: Deep technical references (`references/`), static templates/fixtures (`assets/`), and executable scripts (`scripts/`) are loaded or invoked selectively only when needed.

---

## 2. Directory Layout & Standards

Every skill strictly adheres to the standard layout:

```text
skills/<skill-name>/
├── SKILL.md              # REQUIRED: YAML frontmatter + structured action procedures
├── scripts/              # OPTIONAL: Executable helper scripts (PowerShell, Bash, Python)
├── references/           # OPTIONAL: Deep technical documentation, formulas, schemas
└── assets/               # OPTIONAL: Mock data fixtures, sample JSON payloads, templates
```

---

## 3. Skills Catalog

| Skill Identifier | Domain & Scope | Primary Triggers |
|---|---|---|
| [`denguesense`](./denguesense/SKILL.md) | **Master Runbook & Orchestrator**: High-level system overview, monorepo architecture, demo credentials, and ADRs. | Exploring the project, general architecture questions, high-level guidance. |
| [`denguesense-quality-gate`](./denguesense-quality-gate/SKILL.md) | **Quality Gate & CI/CD**: Enforces multi-layer validation (Contracts $\to$ Dashboard $\to$ Go Backend $\to$ Python AI Service). | Pre-commit checks, PR reviews, CI failure recovery, automated lint/tests. |
| [`denguesense-layer3-genai`](./denguesense-layer3-genai/SKILL.md) | **Guardrailed GenAI & B2G Digital Workflow**: 6 automated guardrails (G1-G6), verbatim legal citations, immutable plan snapshots, 4-eyes digital signing. | Generating administrative dispatches, citation matching, guardrail compliance. |
| [`denguesense-layer1-forecast`](./denguesense-layer1-forecast/SKILL.md) | **Outbreak Forecasting & SEIR-V Epidemiology**: Spatio-temporal LightGBM/CatBoost, SEIR-V ODEs, Conformal Prediction intervals (80/90/95%), ERA5 climate features. | Modifying prediction pipelines, adjusting model intervals, climate feature store. |
| [`denguesense-fsd-frontend`](./denguesense-fsd-frontend/SKILL.md) | **Feature-Sliced Design Dashboard**: React 19, TypeScript strict mode (`verbatimModuleSyntax`), unconditional hooks, Vitest + MSW mocking. | Modifying dashboard UI, fixing FSD boundary violations, adding frontend features. |
| [`denguesense-backend-contracts`](./denguesense-backend-contracts/SKILL.md) | **Contract-First Go Microservices**: OpenAPI 3.1 synchronization (Redocly, oasdiff), Go clean architecture, PostgreSQL migrations (`golang-migrate`), RFC 7807 errors. | Updating API contracts, Go microservice handlers, database schema migrations. |
| [`denguesense-e2e-workflows`](./denguesense-e2e-workflows/SKILL.md) | **E2E Closed-Loop Workflows & Personas**: Complete user journeys across 4 roles (`officer`, `approver`, `analyst`, `viewer`), Playwright E2E testing, competition demo script. | Rehearsing live pitches, verifying persona journeys, running Playwright tests. |

---

## 4. Multi-Agent Discovery Paths

- **Google Antigravity**: Discovers project customizations at `.agents/skills/`.
- **Open Agent Frameworks (Cursor, Claude Code, CodeX, LangChain)**: Discover skills at `./skills/` or `.agents/skills/`.
- Both directories are maintained in sync within this repository to guarantee 100% interoperability across all modern development tools.
