[CmdletBinding()]
param([string]$GoExecutable='go')
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$directory=Join-Path $repo ('.data/acceptance/'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$previousToken=$env:CLOUDDRIVE_TEST_SETUP_TOKEN
$previousPassword=$env:CLOUDDRIVE_TEST_PASSWORD
Push-Location $repo
try {
    if (-not (Get-Command $GoExecutable -ErrorAction SilentlyContinue)) {
        $portable=Join-Path $env:LOCALAPPDATA 'clouddrive-tools/go1.26.10/go/bin/go.exe'
        if(Test-Path -LiteralPath $portable){$GoExecutable=$portable}else{throw 'Go 1.26.10 is required.'}
    }
    if ((& $GoExecutable version) -notmatch 'go1\.26\.10\b') { throw 'Go 1.26.10 is required.' }
    & $GoExecutable build -o .tools/clouddrive-acceptance.exe ./cmd/app
    if($LASTEXITCODE -ne 0){throw 'Backend build failed'}
    $env:CLOUDDRIVE_TEST_SETUP_TOKEN=[guid]::NewGuid().ToString('N')
    $env:CLOUDDRIVE_TEST_PASSWORD=[guid]::NewGuid().ToString('N')
    @"
logger:
  environment: development
  level: warn
database:
  driver: sqlite
  dsn: app.db
auth:
  mode: session
iam:
  local:
    setupToken: $env:CLOUDDRIVE_TEST_SETUP_TOKEN
http:
  addr: 127.0.0.1:8088
  cors:
    allowedOrigins: [http://127.0.0.1:4185]
management:
  addr: 127.0.0.1:9098
console:
  relay:
    allowedOrigins: [http://127.0.0.1:8088]
"@ | Set-Content -LiteralPath (Join-Path $directory 'config.yaml')
    Push-Location $directory
    try { & (Join-Path $repo '.tools/clouddrive-acceptance.exe') db migrate up; if($LASTEXITCODE -ne 0){throw 'Empty database migration failed'} } finally {Pop-Location}
    $backend=Start-Process -FilePath (Join-Path $repo '.tools/clouddrive-acceptance.exe') -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $directory 'backend.log') -RedirectStandardError (Join-Path $directory 'backend-error.log')
    $deadline=[DateTime]::UtcNow.AddSeconds(30)
    $ready=$false
    do {
        if($backend.HasExited){throw 'Acceptance backend exited; inspect its logs.'}
        try{$ready=(Invoke-WebRequest -Uri 'http://127.0.0.1:8088/api/console/v1/auth/registration-policy' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200}catch{Start-Sleep -Milliseconds 200}
    }while(-not $ready -and [DateTime]::UtcNow -lt $deadline)
    if(-not $ready){throw 'Acceptance backend did not become ready.'}
    Push-Location frontend
    try { & npx --yes pnpm@10.22.0 exec playwright test --config playwright.integration.config.ts; if($LASTEXITCODE -ne 0){throw 'Real browser integration failed'} } finally {Pop-Location}
    Write-Host "Acceptance data and logs: $directory"
} finally {
    if($backend){Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue}
    $env:CLOUDDRIVE_TEST_SETUP_TOKEN=$previousToken
    $env:CLOUDDRIVE_TEST_PASSWORD=$previousPassword
    Pop-Location
}
