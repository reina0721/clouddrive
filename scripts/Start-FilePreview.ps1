[CmdletBinding()]
param([string]$GoExecutable = '', [int]$WebPort = 4180, [int]$ApiPort = 8120, [int]$ManagementPort = 9120)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$previewDirectory = Join-Path $repo '.data/file-preview'
$statePath = Join-Path $previewDirectory 'processes.json'
$accessPath = Join-Path $repo '.data/preview-access.json'
New-Item -ItemType Directory -Force -Path $previewDirectory, (Join-Path $repo '.tools') | Out-Null

# 只重启由本脚本记录且启动时间吻合的预览进程，不接管原有开发环境。
if (Test-Path -LiteralPath $statePath) {
    foreach ($record in (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json)) {
        $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
        $started = if ($record.started -is [DateTime]) { $record.started.ToUniversalTime() } else { [DateTime]::Parse($record.started).ToUniversalTime() }
        if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq $started.Ticks) {
            & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
        }
    }
}
foreach ($port in @($WebPort, $ApiPort, $ManagementPort)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Preview port $port is already occupied." }
}
if (-not $GoExecutable) { $GoExecutable = Join-Path $env:LOCALAPPDATA 'clouddrive-tools/go/bin/go.exe' }
$binaryPath = Join-Path $repo '.tools/clouddrive-file-preview.exe'
Push-Location $repo
try {
    & $GoExecutable build -o $binaryPath ./cmd/app
    if ($LASTEXITCODE -ne 0) { throw 'Preview backend build failed.' }
    if (Test-Path -LiteralPath $accessPath) {
        $access = Get-Content -LiteralPath $accessPath -Raw | ConvertFrom-Json
    } else {
        $access = [pscustomobject]@{
            url = "http://127.0.0.1:$WebPort/home"
            apiUrl = "http://127.0.0.1:$ApiPort"
            managementUrl = "http://127.0.0.1:$ManagementPort"
            username = 'preview@clouddrive.test'
            password = [guid]::NewGuid().ToString('N')
            setupToken = [guid]::NewGuid().ToString('N')
            dataDirectory = $previewDirectory
        }
        $access | ConvertTo-Json | Set-Content -LiteralPath $accessPath
    }
    $access.url = "http://127.0.0.1:$WebPort/home"
    $access.apiUrl = "http://127.0.0.1:$ApiPort"
    $access.managementUrl = "http://127.0.0.1:$ManagementPort"
    $access.dataDirectory = $previewDirectory
    $access | ConvertTo-Json | Set-Content -LiteralPath $accessPath
    $storagePath = (Join-Path $previewDirectory 'storage').Replace('\', '/').Replace("'", "''")
    $stagingPath = (Join-Path $previewDirectory 'transfers').Replace('\', '/').Replace("'", "''")
    @"
logger:
  environment: development
  level: debug
database:
  driver: sqlite
  dsn: app.db
auth:
  mode: session
iam:
  local:
    setupToken: $($access.setupToken)
http:
  addr: 127.0.0.1:$ApiPort
  maxRequestBodyBytes: 33554432
  cors:
    allowedOrigins: [http://127.0.0.1:$WebPort]
management:
  addr: 127.0.0.1:$ManagementPort
storage:
  driver: local
  local:
    basePath: '$storagePath'
files:
  transfers:
    stagingPath: '$stagingPath'
"@ | Set-Content -LiteralPath (Join-Path $previewDirectory 'config.yaml')
    Push-Location $previewDirectory
    try { & $binaryPath db migrate up; if ($LASTEXITCODE -ne 0) { throw 'Preview migration failed.' } } finally { Pop-Location }
    $backend = Start-Process -FilePath $binaryPath -WorkingDirectory $previewDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $previewDirectory 'backend.log') -RedirectStandardError (Join-Path $previewDirectory 'backend-error.log')
    $records = @(@{ id = $backend.Id; started = $backend.StartTime.ToUniversalTime().ToString('o') })
    $records | ConvertTo-Json -AsArray | Set-Content -LiteralPath $statePath
    $names = @('NEXT_PUBLIC_AUTH_MODE', 'NEXT_PUBLIC_AUTH_API_BASE_URL', 'CLOUDDRIVE_BACKEND_URL', 'NEXT_DIST_DIR')
    $previous = @{}
    foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name) }
    try {
        $env:NEXT_PUBLIC_AUTH_MODE = 'backend'
        $env:NEXT_PUBLIC_AUTH_API_BASE_URL = '/api/console/v1'
        $env:CLOUDDRIVE_BACKEND_URL = "http://127.0.0.1:$ApiPort"
        $env:NEXT_DIST_DIR = '.next/file-preview'
        $command = "Set-Location -LiteralPath '" + $repo.Replace("'", "''") + "/frontend'; & npx --yes pnpm@10.22.0 --filter '@clouddrive/web' exec next dev --hostname 127.0.0.1 --port $WebPort; exit `$LASTEXITCODE"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
        $frontend = Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile', '-EncodedCommand', $encoded) -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $previewDirectory 'frontend.log') -RedirectStandardError (Join-Path $previewDirectory 'frontend-error.log')
        $records += @{ id = $frontend.Id; started = $frontend.StartTime.ToUniversalTime().ToString('o') }
        $records | ConvertTo-Json -AsArray | Set-Content -LiteralPath $statePath
    } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
    }
    foreach ($url in @("http://127.0.0.1:$ApiPort/api/console/v1/auth/registration-policy", "http://127.0.0.1:$WebPort/login")) {
        $deadline = [DateTime]::UtcNow.AddSeconds(45)
        $ready = $false
        do {
            if ($backend.HasExited -or $frontend.HasExited) { throw 'Preview process exited; inspect preview logs.' }
            try { $ready = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { Start-Sleep -Milliseconds 200 }
        } while (-not $ready -and [DateTime]::UtcNow -lt $deadline)
        if (-not $ready) { throw 'Preview readiness timed out; inspect preview logs.' }
    }
    & node (Join-Path $PSScriptRoot 'initialize-file-preview.mjs') $accessPath
    if ($LASTEXITCODE -ne 0) { throw 'Preview credentials were not verified; inspect preview logs.' }
    Write-Host "Latest file preview: http://127.0.0.1:$WebPort/home"
    Write-Host 'Verified credentials and setup token: .data/preview-access.json (ignored by Git)'
} finally { Pop-Location }
