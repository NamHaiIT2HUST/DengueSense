# DengueSense Quality Gate Matrix & Troubleshooting Runbook

This reference document defines the complete quality baseline for all layers in the DengueSense monorepo, detailing tools, configurations, thresholds, and specific error recovery steps.

---

## 1. Quality Matrix Summary

| Layer | Tools | Config File | Pass Criteria | Fast Mode Command |
|---|---|---|---|---|
| **Contracts** | Redocly CLI | `contracts/redocly.yaml` | 0 errors, valid OpenAPI 3.1 | `npx @redocly/cli lint` |
| **Dashboard** | TypeScript, DepCruise, Vitest, Oxlint | `dashboard/tsconfig.json`, `.dependency-cruiser.cjs` | 0 type errors, 0 FSD circular/layer violations, 249/249 tests green | `npm run typecheck && npm test` |
| **Backend** | Go compiler, Go vet, Go test | `backend/go.mod` | 0 vet warnings, 100% unit & integration tests pass | `go test ./...` |
| **AI Service** | Ruff, Mypy, Pytest | `ai-service/pyproject.toml`, `pytest.ini` | 0 format issues, 0 type errors, 100% test pass | `pytest -q tests/test_serving` |

---

## 2. Common Failures & Triage Guide

### A. Dashboard: `verbatimModuleSyntax` TS Error
- **Symptom**: `TS1484: 'X' is a type and must be imported using a type-only import`.
- **Cause**: TypeScript config has `verbatimModuleSyntax: true` to prevent bundler pollution.
- **Fix**: Replace `import { Foo }` with `import { type Foo }`.

### B. Dashboard: Dependency Cruiser FSD Layer Violation
- **Symptom**: `depcruise: error: shared/xyz imports features/abc`.
- **Cause**: Feature-Sliced Design strictly forbids low layers (`shared`) from importing high layers (`features` or `app`).
- **Fix**: Move shared utilities or types down to `shared/` or pass them as props/inversion of control.

### C. Backend: Legal Citation Validation Fails (HTTP 502)
- **Symptom**: `TestValidCitations_StrictVerification` fails with 502 Bad Gateway.
- **Cause**: Citation document ID is not an exact match in `knownLegalCitations` or hostname is not strictly whitelisted (`congbao.chinhphu.vn`, `file.medinet.gov.vn`, `medinet.gov.vn`, `trungtamytengoquyen.vn`, `moh.gov.vn`, `vanban.chinhphu.vn`).
- **Fix**: Review exact document IDs (`vn-moh-qd3711-2014`, `vn-qd02-2016`, `vn-nd30-2020`). Substring matching is forbidden.

### D. AI Service: Service Token Authentication Fails (HTTP 401/403)
- **Symptom**: `test_requires_service_token` or service integration tests fail with 401/403.
- **Cause**: Missing or mismatched `DENGUESENSE_SERVICE_TOKEN` or audience claim in `service_auth.py`.
- **Fix**: Ensure test fixtures generate HMAC token with audience `"genai"` or pass mock headers.
