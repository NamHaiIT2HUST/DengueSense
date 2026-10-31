# Contract-First Development & Database Migration Guide

This reference outlines the exact steps to register new endpoints, generate typed interfaces, and execute database migrations.

---

## 1. Code Generation Reference

When contracts in `contracts/openapi/*.yaml` change:

### Dashboard TypeScript Generation:
```powershell
cd dashboard
npm run codegen
```
- Outputs to `dashboard/src/shared/api/schema.gen.ts`.
- Check git diff to ensure types reflect new endpoints.

### Backend Go Code Generation:
```powershell
cd backend
go generate ./...
```
- Uses `oapi-codegen` to produce `api.gen.go` interfaces in `backend/services/<service>/api/`.

---

## 2. Microservice Ports & Routing Map

| Service | Internal Port | Gateway Path Prefix | DB Database |
|---|---|---|---|
| **gateway** | 8080 | `/api/v1/*` | None (Stateless) |
| **identity** | 8081 | `/api/v1/auth/*` | `denguesense_identity` |
| **surveillance** | 8082 | `/api/v1/surveillance/*` | `denguesense_surveillance` |
| **workflow** | 8083 | `/api/v1/cases/*`, `/api/v1/plans/*`, `/api/v1/drafts/*` | `denguesense_workflow` |
| **notification** | 8084 | `/api/v1/notifications/*` | `denguesense_notification` |
| **ai-service** | 8000 | `/internal/v1/genai/*`, `/internal/v1/forecast/*` | None (Direct ML/Storage) |

---

## 3. Writing Migration Tests
Every new database migration in `backend/services/<service>/migrations` must have an integration test verifying that:
1. All `.up.sql` scripts apply cleanly to an empty database.
2. All `.down.sql` scripts rollback cleanly without foreign key deadlocks.
3. Replying `.up.sql` scripts restores the exact expected schema.
