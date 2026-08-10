$ErrorActionPreference = "Stop"
if (Test-Path ".next") {
  Remove-Item -Recurse -Force ".next"
}
npm.cmd run dev
