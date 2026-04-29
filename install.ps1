# HARNESS installer trampoline (PowerShell).
# Real work in scripts/install-plan.js / scripts/install-apply.js.

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Node 22+ 검증
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error 'node 22+ 가 필요합니다. https://nodejs.org/'
  exit 1
}

$nodeVersion = & node -e 'process.stdout.write(String(process.versions.node.split(\".\")[0]))'
if ([int]$nodeVersion -lt 22) {
  $current = & node -v
  Write-Error "Node 22+ 필요 (현재: $current)"
  exit 1
}

# 인자 분리
$Mode = 'plan'
$Args = @()
foreach ($arg in $args) {
  switch ($arg) {
    '--apply' { $Mode = 'apply' }
    '--plan'  { $Mode = 'plan' }
    default   { $Args += $arg }
  }
}

$Script = Join-Path $RootDir "scripts\install-$Mode.js"
if (-not (Test-Path $Script)) {
  Write-Error "$Script 가 없습니다."
  exit 1
}

& node $Script @Args
exit $LASTEXITCODE
