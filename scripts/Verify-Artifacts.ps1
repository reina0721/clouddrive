[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$unexpected = @(git ls-files --cached --others --exclude-standard | Where-Object { $_ -match '\.(exe|dll|so|dylib|test|out|db|sqlite|key|pem|p12|pfx|zip|tar|gz)$' })
if ($unexpected.Count -gt 0) {
    throw "Tracked build, database, key, or archive artifacts are forbidden:`n$($unexpected -join "`n")"
}
