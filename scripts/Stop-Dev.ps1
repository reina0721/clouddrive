[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$state = Join-Path (Split-Path -Parent $PSScriptRoot) '.data/dev-processes.json'
if (-not (Test-Path -LiteralPath $state)) { Write-Host 'No recorded development processes.'; return }
$processes = @(Get-CimInstance Win32_Process)
function Stop-RecordedTree([int]$processId) {
    foreach ($child in $processes | Where-Object ParentProcessId -eq $processId) { Stop-RecordedTree $child.ProcessId }
    Stop-Process -Id $processId -ErrorAction SilentlyContinue
}
foreach ($record in (Get-Content -LiteralPath $state -Raw | ConvertFrom-Json)) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    # PowerShell 7 decodes ISO JSON timestamps as DateTime; Windows PowerShell keeps strings.
    $started = if ($record.started -is [DateTime]) { $record.started.ToUniversalTime() } else { [DateTime]::Parse($record.started, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime() }
    if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq $started.Ticks) {
        # taskkill enumerates the live tree, including children spawned after our initial snapshot.
        & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
        Stop-RecordedTree $process.Id
    }
}
Remove-Item -LiteralPath $state
Write-Host 'Recorded clouddrive processes stopped.'
