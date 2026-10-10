# Khởi tạo các tài khoản người dùng chuẩn cho thử nghiệm DengueSense trên Windows PowerShell (idempotent)
$ErrorActionPreference = "Continue"

function Create-User {
    param(
        [string]$Username,
        [string]$Password,
        [string]$DisplayName,
        [string]$Org,
        [string]$Roles
    )

    Write-Host "== Khởi tạo tài khoản: $Username ($Roles)..."
    $env:IDENTITY_NEW_PASSWORD = $Password
    $out = docker compose -f infra/docker-compose.yml exec -T -e "IDENTITY_NEW_PASSWORD=$Password" identity /service create-user -username $Username -display-name $DisplayName -org $Org -roles $Roles 2>&1
    if ($out -match "tên đăng nhập đã tồn tại") {
        Write-Host "   -> Tài khoản '$Username' đã tồn tại sẵn trong hệ thống." -ForegroundColor Yellow
    } else {
        Write-Host "   -> $out" -ForegroundColor Green
    }
}

Create-User -Username "officer" -Password "officer123456" -DisplayName "Cán bộ điều hành CDC" -Org "cdc-hcm" -Roles "officer"
Create-User -Username "approver" -Password "approver123456" -DisplayName "Lãnh đạo phê duyệt CDC" -Org "cdc-hcm" -Roles "approver"
Create-User -Username "dev-analyst" -Password "ujMOTLmI2sRHa7X-oN7L9oky" -DisplayName "Chuyên viên dịch tễ" -Org "cdc-hcm" -Roles "analyst"
Create-User -Username "dev-viewer" -Password "a6BlIE3BM_whDmzRPxIbMK6O" -DisplayName "Người theo dõi" -Org "cdc-hcm" -Roles "viewer"

Write-Host "== Khởi tạo tài khoản hoàn tất!" -ForegroundColor Cyan
