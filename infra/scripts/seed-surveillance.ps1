# Nạp danh mục tỉnh, ranh giới và panel lịch sử vào Surveillance thật (idempotent).
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$panel = Join-Path $root 'ai-service/data/processed/v0.2.0/panel_monthly.parquet'
$manifest = Join-Path $root 'ai-service/data/processed/v0.2.0/manifest.json'
if (-not (Test-Path $panel) -or -not (Test-Path $manifest)) {
    throw 'Thiếu panel v0.2.0 (panel_monthly.parquet và manifest.json). Xem README.md mục Chuẩn bị dữ liệu; không dùng dữ liệu mock để thay thế.'
}

Push-Location $root
try {
    $compose = @('compose', '-f', 'infra/docker-compose.yml', '-f', 'infra/docker-compose.dev.yml', '--profile', 'tools', 'run', '--rm', '--no-deps', 'surveillance-cli')
    & docker @compose seed -provinces /data/province_metadata.csv -geometry /data/provinces.geojson -geometry-version 2025-07
    if ($LASTEXITCODE -ne 0) { throw 'Không nạp được danh mục tỉnh/ranh giới.' }
    & docker @compose import-panel -panel /data/processed/v0.2.0/panel_monthly.parquet -manifest /data/processed/v0.2.0/manifest.json -version v0.2.0
    if ($LASTEXITCODE -ne 0) { throw 'Không nạp được panel v0.2.0.' }
} finally { Pop-Location }

Write-Host 'Đã nạp danh mục 34 tỉnh và panel v0.2.0 vào Surveillance.'
