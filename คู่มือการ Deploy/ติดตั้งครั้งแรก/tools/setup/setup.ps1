# ติดตั้งครั้งแรกบนเครื่องใหม่ (Windows) — เรียกจาก ติดตั้งครั้งแรก.cmd
#   1. Node.js 22+          ไม่มี/รุ่นเก่า = winget ติดตั้ง OpenJS.NodeJS.LTS
#   2. Python 3.11+         ไม่มี = winget ติดตั้ง Python.Python.3.12
#   3. etl\.venv            สร้าง venv + pip install -r etl\requirements.txt (plugin ETL ของ vite หา python จากที่นี่)
#   4. app\node_modules     npm ci (lockfile commit ไว้แล้ว)
# ทุกขั้นข้ามถ้าทำไว้แล้ว — กดซ้ำได้ไม่เสียหาย
# ★ ไฟล์นี้ต้องบันทึกเป็น UTF-8 มี BOM ไม่งั้น PowerShell 5.1 อ่านภาษาไทยเพี้ยน

# ★ ไม่ใช้ "Stop" — PowerShell 5.1 แปลงข้อความ stderr ของ pip/npm/python เป็น error แล้วหยุดสคริปต์ทั้งที่ทำงานสำเร็จ
#   ตัดสินผลจาก $LASTEXITCODE ของแต่ละคำสั่งแทน
$ErrorActionPreference = "Continue"

function Step($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "   ✓ $t" -ForegroundColor Green }
function Warn($t) { Write-Host "   ! $t" -ForegroundColor Yellow }
function Fail($t) { Write-Host ""; Write-Host "✗ $t" -ForegroundColor Red; exit 1 }

# หารากโปรเจกต์ = โฟลเดอร์ที่มี app\package.json และ etl\requirements.txt (ไล่ขึ้นจากที่อยู่ของสคริปต์)
$Root = $PSScriptRoot
while ($Root -and -not ((Test-Path (Join-Path $Root "app\package.json")) -and (Test-Path (Join-Path $Root "etl\requirements.txt")))) {
  $Root = Split-Path $Root -Parent
}
if (-not $Root) { Fail "หาโฟลเดอร์โปรเจกต์ไม่เจอ — วางโฟลเดอร์ คู่มือการ Deploy ไว้ในโปรเจกต์ตามเดิม" }
Write-Host "โปรเจกต์: $Root"
# pip แตกไฟล์ลึกใน etl\.venv\Lib\site-packages\... — path รวมเกิน 260 ตัวอักษรของ Windows แล้วล้ม (WinError 206)
if ($Root.Length -gt 110) {
  Warn "ที่อยู่โปรเจกต์ยาว $($Root.Length) ตัวอักษร — ถ้าขั้นที่ 3 ล้มเพราะชื่อไฟล์ยาวเกิน ให้ย้ายโปรเจกต์ไปที่สั้นกว่า เช่น C:\fleet-model แล้วกดใหม่"
}

# PATH ของหน้าต่างนี้ไม่รู้จักโปรแกรมที่เพิ่งติดตั้ง — อ่านจาก registry ใหม่
function Refresh-Path {
  $m = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $u = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$m;$u"
}

function Need-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail "เครื่องนี้ไม่มี winget — ติดตั้ง 'App Installer' จาก Microsoft Store หรือดาวน์โหลด Node.js (nodejs.org) / Python (python.org) เองแล้วกดไฟล์นี้ใหม่"
  }
}

function Winget-Install($id, $name) {
  Need-Winget
  Write-Host "   กำลังติดตั้ง $name ผ่าน winget (อาจมีหน้าต่างขออนุญาต — กด Yes)..."
  & winget install --id $id -e --source winget --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { Warn "winget ตอบรหัส $LASTEXITCODE — ตรวจผลด้านล่าง" }
  Refresh-Path
}

# ---------------------------------------------------------------- 1. Node.js
Step "1/4 Node.js 22+"
function Node-Major {
  try { $v = (& node -v) 2>$null; if ($v -match '^v(\d+)') { return [int]$Matches[1] } } catch {}
  return 0
}
$nm = Node-Major
if ($nm -ge 22) { Ok "มีแล้ว ($(& node -v))" }
else {
  if ($nm -gt 0) { Warn "รุ่นเดิม v$nm เก่าเกินไป" }
  Winget-Install "OpenJS.NodeJS.LTS" "Node.js LTS"
  $nm = Node-Major
  if ($nm -ge 22) { Ok "ติดตั้งแล้ว ($(& node -v))" }
  else { Fail "ยังไม่เจอ Node.js 22+ — ปิดหน้าต่างนี้แล้วกด ติดตั้งครั้งแรก.cmd ใหม่ (PATH บางเครื่องต้องเปิดหน้าต่างใหม่)" }
}

# ---------------------------------------------------------------- 2. Python
Step "2/4 Python 3.11+"
# คืนคำสั่งเรียก python 3.11+ ที่ใช้ได้จริง — ข้ามตัวหลอกของ Microsoft Store (WindowsApps\python.exe ที่เปิด Store แทน)
function Find-Python {
  $tries = @(@("py", "-3.13"), @("py", "-3.12"), @("py", "-3.11"), @("python"), @("python3"))
  foreach ($t in $tries) {
    $exe = $t[0]; $args_ = @($t | Select-Object -Skip 1)
    $cmd = Get-Command $exe -ErrorAction SilentlyContinue
    if (-not $cmd) { continue }
    if ($cmd.Source -like "*\WindowsApps\*" -and $exe -ne "py") { continue }
    try {
      $v = (& $exe @args_ -c "import sys; print('%d.%d' % sys.version_info[:2])") 2>$null
      if ($LASTEXITCODE -eq 0 -and "$v".Trim() -match '^3\.(\d+)$' -and [int]$Matches[1] -ge 11) {
        # คืนเป็น object — array ตัวเดียว ("python") PowerShell จะแตกเป็นสตริง แล้ว [0] ได้แค่ตัวอักษรแรก
        return [pscustomobject]@{ Exe = $exe; Args = $args_ }
      }
    } catch {}
  }
  return $null
}
$py = Find-Python
if ($py) { Ok "มีแล้ว ($(& $py.Exe @($py.Args) --version))" }
else {
  Winget-Install "Python.Python.3.12" "Python 3.12"
  $py = Find-Python
  if ($py) { Ok "ติดตั้งแล้ว ($(& $py.Exe @($py.Args) --version))" }
  else { Fail "ยังไม่เจอ Python 3.11+ — ปิดหน้าต่างนี้แล้วกด ติดตั้งครั้งแรก.cmd ใหม่" }
}

# ---------------------------------------------------------------- 3. etl\.venv
Step "3/4 แพ็กเกจ ETL ใน etl\.venv"
$venv = Join-Path $Root "etl\.venv"
$vpy = Join-Path $venv "Scripts\python.exe"
if (-not (Test-Path $vpy)) {
  Write-Host "   สร้าง venv..."
  & $py.Exe @($py.Args) -m venv $venv
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $vpy)) { Fail "สร้าง etl\.venv ไม่สำเร็จ" }
}
& $vpy -c "import openpyxl, python_calamine" 2>$null
if ($LASTEXITCODE -eq 0) { Ok "มีแพ็กเกจครบแล้ว" }
else {
  Write-Host "   pip install -r etl\requirements.txt ..."
  & $vpy -m pip install --upgrade pip --quiet --disable-pip-version-check
  & $vpy -m pip install -r (Join-Path $Root "etl\requirements.txt") --disable-pip-version-check
  if ($LASTEXITCODE -ne 0) { Fail "ติดตั้งแพ็กเกจ ETL ไม่สำเร็จ — ดูข้อความ pip ด้านบน" }
  Ok "ติดตั้งแพ็กเกจแล้ว"
}

# ---------------------------------------------------------------- 4. npm ci
Step "4/4 แพ็กเกจของเว็บ (app\node_modules)"
$app = Join-Path $Root "app"
if (Test-Path (Join-Path $app "node_modules\.bin\vite.cmd")) { Ok "มีแล้ว" }
else {
  Push-Location $app
  try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { Fail "npm ci ไม่สำเร็จ — ดูข้อความด้านบน" }
  } finally { Pop-Location }
  Ok "ติดตั้งแล้ว"
}

Write-Host ""
Write-Host "เสร็จแล้ว ✓" -ForegroundColor Green
Write-Host "เปิดโมเดล: เปิด cmd ในโฟลเดอร์ app แล้วพิมพ์  npm.cmd run dev   → http://localhost:5173/fleet-cost-model/"
Write-Host "ดูคำสั่งอื่นใน คู่มือการ Deploy\โค้ดที่ต้องใส่หลังเปิด folder.txt"
