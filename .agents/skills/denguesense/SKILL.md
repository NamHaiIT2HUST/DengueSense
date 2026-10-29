---
name: denguesense
description: >-
  Comprehensive context guide for the DengueSense project — a closed-loop dengue
  epidemic surveillance and decision-making platform for Vietnam's 34 provinces.
  Activate this skill when working on any aspect of DengueSense: adding features,
  fixing bugs, writing tests, reviewing code, or answering questions about the
  codebase architecture, domain logic, or regulatory compliance.
---

# DengueSense — Project Context & Runbook

> [!IMPORTANT]
> Always run the full quality gate **before every commit**: format → lint → typecheck → depcruise → vitest → playwright.
> All 248 Vitest tests and 47 Playwright E2E scenarios must stay green.

---

## 1. Project Overview

**DengueSense** is a competition-grade, full-stack platform for real-time dengue surveillance across Vietnam's 34 provinces/cities. It integrates AI-driven outbreak prediction, regulatory-compliant digital workflows, inter-provincial logistics, and field-level entomological monitoring.

- **Live demo:** https://denguesense.vercel.app/
- **GitHub:** https://github.com/NamHaiIT2HUST/DengueSense
- **Branch:** `main` (direct push; no PR needed unless user explicitly requests)

### Demo Credentials

| Role | Username | Password |
|---|---|---|
| Cán bộ dịch tễ | `officer` | `officer123` |
| Phê duyệt B2G | `approver` | `approver123` |
| Phân tích | `demo.phan-tich` | `phantich123` |
| Chỉ xem | `demo.xem` | `xem123` |

---

## 2. Monorepo Structure

```
DengueSense/
├── dashboard/          # React 19 + TypeScript + Vite (Feature-Sliced Design)
├── backend/            # Go 1.24 microservices
├── ai-service/         # Python 3.13 FastAPI (forecasting models)
├── infra/              # Docker Compose orchestration
├── contracts/          # Shared API contracts / OpenAPI specs
├── docs/               # Architecture diagrams, decision records
└── .agents/            # AGY customizations (this file lives here)
```

---

## 3. Frontend Architecture (Feature-Sliced Design)

**Location:** `dashboard/src/`

```
app/          # App-level: router, providers, global styles
features/     # Feature slices (self-contained UI + logic units)
  cases/      # Case management, B2G reports, outbreak alerts
  auth/       # Authentication
  province-detail/  # Per-province dashboard cards
shared/       # Cross-cutting concerns (never imports from features/)
  lib/        # Pure business logic & utilities
  ui/         # Reusable UI components
  i18n/       # Vietnamese strings (vi.ts)
  hooks/      # Shared React hooks
```

### FSD Boundary Rules (enforced by Dependency Cruiser)

- `shared/` must NOT import from `features/` or `app/`
- `features/` slices must NOT import from each other directly — only via `index.ts` barrels
- `app/` may import from anywhere
- Violation check: `npm --prefix dashboard run depcruise`

---

## 4. Code Conventions

### TypeScript (Strict Mode)

- `verbatimModuleSyntax` is **enabled** → **always** use `import { type Foo }` (not `import { Foo }`) for type-only imports
- No unused variables or imports (enforced by Oxlint)
- `@/` alias maps to `dashboard/src/`

```typescript
// ✅ Correct
import { type ProvinceData } from '@/entities/province'
import { useState, useMemo } from 'react'

// ❌ Wrong — will cause TypeScript error
import { ProvinceData } from '@/entities/province'
```

### React Rules of Hooks

- All hooks (`useState`, `useQuery`, `useMemo`, etc.) must be called **unconditionally** — before any early returns
- Pattern: declare all hooks → validate inputs → conditional render logic

### Exports

- Every feature/slice exports via `index.ts` barrel file
- Named exports only (no default exports in shared libs)

### Tailwind & Design Tokens

Use CSS custom property tokens — **never** raw color values:

```tsx
// ✅ Correct
className="text-[var(--ink-primary)] bg-[var(--surface-card)]"

// ❌ Avoid
className="text-gray-900 bg-white"
```

Key tokens: `--ink-primary`, `--ink-secondary`, `--ink-muted`, `--accent`, `--accent-red`, `--surface-card`, `--surface-page`, `--border-subtle`

### i18n

All Vietnamese UI strings go in `dashboard/src/shared/i18n/vi.ts`. Do NOT hardcode Vietnamese strings inline in components — look up or add to the i18n file.

---

## 5. Quality Gate Commands

Run **in order** before every commit:

```powershell
# 1. Format
npm --prefix dashboard run format

# 2. Lint (Oxlint — 0 warnings, 0 errors required)
npm --prefix dashboard run lint

# 3. TypeScript type-check (0 errors required)
npm --prefix dashboard run typecheck

# 4. Dependency Cruiser (0 violations required)
npm --prefix dashboard run depcruise

# 5. Unit & integration tests (248/248 must pass)
npm --prefix dashboard run test

# 6. Production build verification
npm --prefix dashboard run build

# 7. E2E tests — Playwright (47/47 must pass)
npm --prefix dashboard run test:e2e
```

> [!TIP]
> Steps 1–4 are fast (< 10s). Run them first as a quick sanity check. Steps 5–7 are slower.

### Backend Tests

```powershell
# Go backend (run from backend/)
cd "d:\Cuộc thi\DengueSense\backend"; go test ./...

# AI service (run from ai-service/)
cd "d:\Cuộc thi\DengueSense\ai-service"; python -m pytest -q
```

---

## 6. Domain Knowledge

### Dengue Surveillance Metrics

| Metric | Formula | Alarm Threshold |
|---|---|---|
| Breteau Index (BI) | Containers with larvae / 100 houses | BI ≥ 30 → alarm |
| House Index (HI) | Houses with larvae / total houses × 100 | HI ≥ 20 → alarm |
| Container Index (CI) | Containers with larvae / all containers × 100 | — |
| Density Index (DI) | Combined weighted risk score | — |

Standard: **QĐ 3711/QĐ-BYT** (MOH Decision 3711 on vector surveillance).

### Regulatory Standards

- **Nghị định 30/2020/NĐ-CP** — Digital document management; four-eyes approval rule (officer cannot self-approve B2G documents)
- **VGCA X.509** — Vietnamese digital signature standard for government documents
- **Two-stage northern thermal trigger** — Epidemic risk adjusts by latitude; northern provinces have seasonality offset vs. southern provinces

### Province Data

34 provinces/cities. Province IDs follow Vietnamese administrative codes. Key provinces in test fixtures: `hcm` (Ho Chi Minh City), `hn` (Hà Nội), `dn` (Đà Nẵng), `ct` (Cần Thơ).

---

## 7. Key Enterprise Modules (12 Capabilities)

Each module has a corresponding lib file in `shared/lib/` and a UI component in `features/`:

| Module | Lib | Component |
|---|---|---|
| Vector Surveillance (QĐ 3711) | `shared/lib/vectorSurveillance.ts` | `features/province-detail/VectorSurveillanceCard.tsx` |
| Digital Signature (VGCA) | `shared/lib/digitalSignature.ts` | `features/cases/DigitalSignaturePanel.tsx` |
| Thermal Trigger (northern) | `shared/lib/thermalTrigger.ts` | `features/province-detail/ThermalTriggerBadge.tsx` |
| Inter-Provincial Transfer | `shared/lib/interProvincialTransfer.ts` | `features/cases/InterProvincialSupplyTransferModal.tsx` |
| CDC Pilot Benchmark | — | `features/cases/PilotEvaluationBenchmark.tsx` |

---

## 8. Git Workflow

```powershell
# Standard commit flow
git -C "d:\Cuộc thi\DengueSense" add -A
git -C "d:\Cuộc thi\DengueSense" commit -m "feat(scope): description"
git -C "d:\Cuộc thi\DengueSense" push origin main
```

### Conventional Commit Types

`feat` | `fix` | `docs` | `refactor` | `test` | `chore` | `perf`

### Scope Examples

`dashboard`, `backend`, `ai-service`, `infra`, `cases`, `surveillance`, `logistics`, `pilot-governance`

---

## 9. Common Errors & Fixes

### TypeScript: "isolatedModules" / verbatimModuleSyntax error
```
error TS1484: 'Foo' is a type and must be imported using a type-only import
```
**Fix:** Change `import { Foo }` → `import { type Foo }`

### React: Hooks after conditional return
```
React Hook "useX" is called conditionally
```
**Fix:** Move ALL hook calls to before the first `if`/early `return` statement.

### Dependency Cruiser violation
```
error: 'features/foo' may not reach 'features/bar'
```
**Fix:** Create/use the `index.ts` barrel in the target slice for cross-slice access.

### `npm run build` fails from repo root
**Fix:** Always use `npm --prefix dashboard run build` (not `cd dashboard && npm run build` in a single command).

### TypeScript: possibly undefined from registry lookup
When indexing into a record with `record[key]`, TypeScript may infer `T | undefined`.  
**Fix:** Add explicit `FALLBACK_X` typed constant instead of using `??` chaining, or use non-null assertion `!` only in test files.

---

## 10. Architecture Decision Records

See `docs/` for ADRs. Key decisions:
- **FSD over traditional layered architecture** — enforces explicit boundaries, easier to scale feature teams
- **TanStack Router** (file-based routing) over React Router — better type-safety for search params and path params
- **TanStack Query** for server state — avoids Redux for API data; local UI state via `useState`
- **Vitest** over Jest — native ESM support, faster HMR-friendly test runs
- **Oxlint** over ESLint — Rust-based, ~50× faster, catches React and TypeScript anti-patterns
