#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo ">>> DengueSense Monorepo Quality Gate Runner (Bash)"
echo "========================================================"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
cd "$REPO_ROOT"

# Gate 1: Contracts
echo ">>> [1/4] Linting OpenAPI contracts..."
(cd contracts && npx --yes @redocly/cli@2 lint)

# Gate 2: Dashboard
echo ">>> [2/4] Testing Dashboard (Typecheck, DepCruise, Vitest)..."
(cd dashboard && npm run typecheck && npm run depcruise && npm test)

# Gate 3: Backend
echo ">>> [3/4] Testing Backend Go microservices..."
(cd backend && go vet ./... && go test ./...)

# Gate 4: AI Service
echo ">>> [4/4] Testing AI Service..."
if [ -d "ai-service/venv" ]; then
    (cd ai-service && ./venv/bin/pytest -q tests/test_serving/)
else
    (cd ai-service && pytest -q tests/test_serving/)
fi

echo "========================================================"
echo ">>> ALL QUALITY GATES PASSED! Repository is ready to commit."
echo "========================================================"
