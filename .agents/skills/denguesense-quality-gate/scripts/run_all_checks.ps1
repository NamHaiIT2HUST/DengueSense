<#
.SYNOPSIS
    DengueSense Monorepo Unified Quality Gate Runner (PowerShell)
.DESCRIPTION
    Executes all quality gates sequentially: Contracts -> Dashboard -> Backend -> AI Service.
#>

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

function Log-Step($msg) {
    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host ">>> $msg" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Log-Success($msg) {
    Write-Host " [PASS] $msg" -ForegroundColor Green
}

function Log-Fail($msg) {
    Write-Host " [FAIL] $msg" -ForegroundColor Red
    exit 1
}

$repoRoot = (Get-Item $PSScriptRoot).Parent.Parent.Parent.FullName
Set-Location $repoRoot

try {
    # Gate 1: OpenAPI Contracts
    Log-Step "Gate 1: OpenAPI Contracts Linting (Redocly)"
    Set-Location "$repoRoot\contracts"
    npx --yes @redocly/cli@2 lint
    if ($LASTEXITCODE -ne 0) { Log-Fail "Contracts linting failed" }
    Log-Success "Contracts specifications are valid"

    # Gate 2: Dashboard Frontend
    Log-Step "Gate 2: Dashboard Frontend (Typecheck, DepCruise, Vitest)"
    Set-Location "$repoRoot\dashboard"
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { Log-Fail "Dashboard typecheck failed" }
    npm run depcruise
    if ($LASTEXITCODE -ne 0) { Log-Fail "FSD layer dependency rules violated" }
    npm test
    if ($LASTEXITCODE -ne 0) { Log-Fail "Dashboard Vitest tests failed" }
    Log-Success "Dashboard frontend quality gate passed"

    # Gate 3: Go Backend
    Log-Step "Gate 3: Go Backend Microservices (Go Vet & Tests)"
    Set-Location "$repoRoot\backend"
    go vet ./...
    if ($LASTEXITCODE -ne 0) { Log-Fail "Go vet detected issues" }
    go test ./...
    if ($LASTEXITCODE -ne 0) { Log-Fail "Backend Go tests failed" }
    Log-Success "Go backend microservices tests passed"

    # Gate 4: Python AI Service
    Log-Step "Gate 4: Python AI Service (Pytest & Quality Check)"
    Set-Location "$repoRoot\ai-service"
    $pythonExe = ".\venv\Scripts\python.exe"
    $pytestExe = ".\venv\Scripts\pytest.exe"
    if (Test-Path $pytestExe) {
        & $pytestExe -q tests/test_serving/
        if ($LASTEXITCODE -ne 0) { Log-Fail "AI Service pytest failed" }
    } else {
        pytest -q tests/test_serving/
        if ($LASTEXITCODE -ne 0) { Log-Fail "AI Service pytest failed" }
    }
    Log-Success "Python AI Service test suite passed"

    $sw.Stop()
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host " ALL QUALITY GATES PASSED in $($sw.Elapsed.TotalSeconds.ToString('F1'))s! Repository is ready to commit." -ForegroundColor Green
    Write-Host "========================================================`n" -ForegroundColor Green
}
finally {
    Set-Location $repoRoot
}
