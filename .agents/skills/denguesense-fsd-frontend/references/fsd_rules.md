# Feature-Sliced Design (FSD) Architectural Rules

This document specifies the layer structure, folder conventions, and anti-patterns for the DengueSense dashboard.

---

## 1. Slices & Segments Breakdown

```text
dashboard/src/
├── app/                  # Application initialization
│   ├── providers/        # React Query, Theme, Toast providers
│   ├── router.tsx        # React Router 7 route definitions
│   └── main.tsx          # Entrypoint mount
├── features/             # Self-contained domain feature slices
│   ├── alerts/           # Outbreak alert triage & intake
│   ├── cases/            # Epidemic case files, resource plans, dispatches
│   ├── dispatch-review/  # Draft inspection, 4-eyes approval, digital signing
│   ├── risk-map/         # Vietnam 34-province Leaflet interactive choropleth
│   ├── scenarios/        # S1, S2, S3 tactical intervention simulation
│   └── model-info/       # Model card, conformal prediction & SHAP transparency
└── shared/               # Universal primitives (Domain-agnostic)
    ├── api/              # API client, OpenAPI generated types, error mappers
    ├── hooks/            # Generic hooks (useDebounce, useWindowSize)
    ├── i18n/             # Vietnamese strings (vi.ts)
    ├── lib/              # Pure functions (formatting, date, math, risk calculations)
    └── ui/               # Base UI kit (Button, Modal, Toast, Input, Badge, Table)
```

---

## 2. Prohibited Anti-Patterns

1. **Circular Dependencies**:
   - Feature A imports from Feature B, and Feature B imports from Feature A.
   - Fix: Extract the common model/types into `shared/api/` or `shared/lib/`.
2. **Deep Cross-Feature Imports**:
   - `import { Modal } from '@/features/cases/components/SubModal'` from `features/alerts/` is prohibited.
   - Only `import { CaseStatus } from '@/features/cases'` is allowed.
3. **Leaking Domain Logic into `shared/ui`**:
   - `shared/ui/Button.tsx` must not know what a "Dengue Case" is. Keep primitives strictly generic.
