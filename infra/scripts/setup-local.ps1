# Khởi tạo cấu hình Docker localhost. Chỉ sinh bí mật khi infra/.env chưa tồn tại.
$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$envFile = Join-Path $root "infra/.env"
$devtoolFile = Join-Path $root "infra/.env.devtool"
$utf8 = New-Object System.Text.UTF8Encoding($false)

function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Invoke-Devtool([string]$operation) {
    Push-Location (Join-Path $root "backend")
    try {
        $lines = & go run ./cmd/devtool $operation 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Không chạy được devtool $operation. Kiểm tra Go rồi thử lại." }
        $values = @{}
        foreach ($line in $lines) {
            if ($line -match '^([A-Z0-9_]+)=(.+)$') { $values[$matches[1]] = $matches[2] }
        }
        return $values
    } finally { Pop-Location }
}

if (Test-Path $envFile) {
    $contents = [System.IO.File]::ReadAllText($envFile)
    if ($contents -match '(?m)^[A-Z0-9_]+=change-me\s*$') {
        throw "infra/.env còn giá trị change-me. Hãy hoàn thiện file hiện có; script sẽ không ghi đè bí mật cũ."
    }
    foreach ($name in @(
        'POSTGRES_PASSWORD', 'SVC_IDENTITY_PASSWORD', 'SVC_SURVEILLANCE_PASSWORD',
        'SVC_FORECAST_PASSWORD', 'SVC_OPTIMIZE_PASSWORD', 'SVC_WORKFLOW_PASSWORD',
        'SVC_GENAI_PASSWORD', 'SVC_NOTIFICATION_PASSWORD', 'GATEWAY_JWT_PUBLIC_KEY',
        'IDENTITY_JWT_PRIVATE_KEY', 'GATEWAY_SERVICE_CLIENT_SECRET',
        'IDENTITY_SERVICE_SECRET_SHA256_GATEWAY', 'FORECAST_SERVICE_CLIENT_SECRET',
        'IDENTITY_SERVICE_SECRET_SHA256_FORECAST', 'WORKFLOW_SERVICE_CLIENT_SECRET',
        'IDENTITY_SERVICE_SECRET_SHA256_WORKFLOW'
    )) {
        if ($contents -notmatch "(?m)^$name=.+$") { throw "infra/.env thiếu giá trị $name." }
    }
    if ($contents -notmatch '(?m)^GENAI_DEMO_MODE=true\s*$') {
        throw 'Demo B2G localhost cần GENAI_DEMO_MODE=true trong infra/.env. Hãy sửa file hiện có rồi chạy lại; script sẽ không tự ghi đè cấu hình.'
    }
    Write-Host "Giữ nguyên infra/.env hiện có."
    exit 0
}

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    throw "Cần Go trong PATH để sinh khóa Ed25519 và bí mật dịch vụ lần đầu."
}

$values = @{}
foreach ($name in @(
    'POSTGRES_PASSWORD', 'SVC_IDENTITY_PASSWORD', 'SVC_SURVEILLANCE_PASSWORD',
    'SVC_FORECAST_PASSWORD', 'SVC_OPTIMIZE_PASSWORD', 'SVC_WORKFLOW_PASSWORD',
    'SVC_GENAI_PASSWORD', 'SVC_NOTIFICATION_PASSWORD'
)) { $values[$name] = New-RandomSecret }

$keys = Invoke-Devtool 'keygen'
if (-not $keys.ContainsKey('PUBLIC') -or -not $keys.ContainsKey('PRIVATE')) { throw 'devtool không sinh đủ cặp khóa.' }
$values['GATEWAY_JWT_PUBLIC_KEY'] = $keys['PUBLIC']
$values['IDENTITY_JWT_PRIVATE_KEY'] = $keys['PRIVATE']

foreach ($pair in @(
    @('GATEWAY_SERVICE_CLIENT_SECRET', 'IDENTITY_SERVICE_SECRET_SHA256_GATEWAY'),
    @('FORECAST_SERVICE_CLIENT_SECRET', 'IDENTITY_SERVICE_SECRET_SHA256_FORECAST'),
    @('WORKFLOW_SERVICE_CLIENT_SECRET', 'IDENTITY_SERVICE_SECRET_SHA256_WORKFLOW')
)) {
    $secret = Invoke-Devtool 'secret'
    if (-not $secret.ContainsKey('SECRET') -or -not $secret.ContainsKey('SHA256')) { throw 'devtool không sinh đủ bí mật dịch vụ.' }
    $values[$pair[0]] = $secret['SECRET']
    $values[$pair[1]] = $secret['SHA256']
}
$values['GENAI_DEMO_MODE'] = 'true'

$template = Join-Path $root 'infra/.env.example'
$lines = foreach ($line in [System.IO.File]::ReadAllLines($template)) {
    if ($line -match '^([A-Z0-9_]+)=') {
        $name = $matches[1]
        if ($values.ContainsKey($name)) { "$name=$($values[$name])"; continue }
    }
    $line
}
if ($lines -match '(?m)^[A-Z0-9_]+=change-me\s*$') { throw 'Còn bí mật mẫu chưa được thay.' }
[System.IO.File]::WriteAllLines($envFile, [string[]]$lines, $utf8)

if (-not (Test-Path $devtoolFile)) {
    [System.IO.File]::WriteAllLines($devtoolFile, [string[]]@("DEV_JWT_PRIVATE_KEY=$($keys['PRIVATE'])"), $utf8)
}
Write-Host 'Đã tạo infra/.env bằng bí mật ngẫu nhiên và bật chế độ công điện mô phỏng cho localhost.'
Write-Host 'GEMINI_API_KEY để trống; chỉ thêm khóa mới sau khi đã thu hồi khóa từng lộ.'
