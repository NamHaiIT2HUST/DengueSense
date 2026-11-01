# Tạo 4 tài khoản demo trong Identity thật; mật khẩu ngẫu nhiên chỉ lưu ngoài Git.
$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$devtoolFile = Join-Path $root 'infra/.env.devtool'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function New-RandomPassword {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$saved = @{}
if (Test-Path $devtoolFile) {
    foreach ($line in [System.IO.File]::ReadAllLines($devtoolFile)) {
        if ($line -match '^([A-Z0-9_]+)=(.*)$') { $saved[$matches[1]] = $matches[2] }
    }
}

$users = @(
    @{ Name = 'local-officer'; Key = 'DEMO_OFFICER_PASSWORD'; Display = 'Cán bộ điều hành CDC'; Role = 'officer' },
    @{ Name = 'local-approver'; Key = 'DEMO_APPROVER_PASSWORD'; Display = 'Lãnh đạo phê duyệt CDC'; Role = 'approver' },
    @{ Name = 'dev-analyst'; Key = 'DEV_ANALYST_PASSWORD'; Display = 'Chuyên viên dịch tễ'; Role = 'analyst' },
    @{ Name = 'dev-viewer'; Key = 'DEV_VIEWER_PASSWORD'; Display = 'Người theo dõi'; Role = 'viewer' }
)

Push-Location $root
try {
    foreach ($user in $users) {
        $password = if ($saved.ContainsKey($user.Key) -and $saved[$user.Key]) { $saved[$user.Key] } else { New-RandomPassword }
        $oldPassword = [Environment]::GetEnvironmentVariable('IDENTITY_NEW_PASSWORD', 'Process')
        try {
            $env:IDENTITY_NEW_PASSWORD = $password
            # Compose lấy giá trị từ môi trường tiến trình; không đưa mật khẩu vào đối số CLI.
            $output = & docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec -T -e IDENTITY_NEW_PASSWORD identity /service create-user `
                -username $user.Name -display-name $user.Display -org cdc-hcm -roles $user.Role 2>&1
            $code = $LASTEXITCODE
        } finally {
            if ($null -eq $oldPassword) { Remove-Item Env:IDENTITY_NEW_PASSWORD -ErrorAction SilentlyContinue }
            else { $env:IDENTITY_NEW_PASSWORD = $oldPassword }
        }
        if ($code -eq 0) {
            if (-not $saved.ContainsKey($user.Key)) {
                [System.IO.File]::AppendAllText($devtoolFile, "`n$($user.Key)=$password`n", $utf8)
                $saved[$user.Key] = $password
            }
            Write-Host "Đã tạo $($user.Name) ($($user.Role)); mật khẩu lưu trong infra/.env.devtool."
        } elseif (($output -join "`n") -match 'tên đăng nhập đã tồn tại') {
            if ($saved.ContainsKey($user.Key)) {
                Write-Host "$($user.Name) đã tồn tại; giữ mật khẩu đã lưu."
            } else {
                Write-Warning "$($user.Name) đã tồn tại nhưng không có mật khẩu lưu trong infra/.env.devtool. Script không thay đổi mật khẩu cũ."
            }
        } else {
            throw "Không tạo được $($user.Name): $($output -join ' ')"
        }
    }
} finally { Pop-Location }

Write-Host 'Xong. Đăng nhập tại http://127.0.0.1:3000 bằng tài khoản và mật khẩu trong infra/.env.devtool.'
