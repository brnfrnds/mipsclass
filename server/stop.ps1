# Stops the MIPS Office server: kills whatever process is listening on :3000.
$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $conns) {
  Write-Host "Server not running (nothing is listening on :3000)."
  exit 0
}
foreach ($c in $conns) {
  Stop-Process -Id $c.OwningProcess -Force
  Write-Host ("Server stopped (was PID " + $c.OwningProcess + " on :3000).")
}
