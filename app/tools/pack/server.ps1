# เว็บเซิร์ฟเวอร์ไฟล์นิ่งสำหรับเปิดโมเดลบนเครื่องที่ไม่มี Node/Python — ใช้ PowerShell ที่มากับ Windows
# เสิร์ฟโฟลเดอร์ site\fleet-cost-model\ (สำเนา dist-real) ที่ http://localhost:4174/fleet-cost-model/ เหมือน npm run serve:real
# ★ ไฟล์นี้ต้องบันทึกเป็น UTF-8 มี BOM (pack-real.mjs ใส่ให้) ไม่งั้น PowerShell 5.1 อ่านภาษาไทยเพี้ยน
param([int]$Port = 4174, [switch]$NoOpen)

$ErrorActionPreference = "Stop"
$Base = "/fleet-cost-model/"
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "site\fleet-cost-model"))

if (-not (Test-Path (Join-Path $Root "index.html"))) {
  Write-Host "ไม่พบ site\fleet-cost-model\index.html ข้างไฟล์นี้ — คลายไฟล์ zip ให้ครบทั้งโฟลเดอร์ก่อน" -ForegroundColor Red
  exit 1
}

# หาพอร์ตว่าง เริ่ม 4174 (localhost ไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ)
$listener = $null
for ($p = $Port; $p -lt $Port + 10; $p++) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host "เปิดพอร์ต $Port-$($Port + 9) ไม่ได้ (ถูกใช้อยู่ทั้งหมด)" -ForegroundColor Red; exit 1 }

# ตัวรับคำขอ — รันหลายตัวพร้อมกัน เบราว์เซอร์โหลดไฟล์ข้อมูลหลายไฟล์ขนานกัน
$worker = {
  param($listener, $Root, $Base)
  $mime = @{
    ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".mjs" = "text/javascript; charset=utf-8"
    ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8"; ".ndjson" = "application/x-ndjson; charset=utf-8"
    ".svg" = "image/svg+xml"; ".png" = "image/png"; ".webp" = "image/webp"; ".jpg" = "image/jpeg"; ".ico" = "image/x-icon"
    ".woff2" = "font/woff2"; ".woff" = "font/woff"; ".ttf" = "font/ttf"; ".txt" = "text/plain; charset=utf-8"
    ".map" = "application/json"; ".bin" = "application/octet-stream"
  }
  while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
      if ($path -eq "/" -or $path -eq $Base.TrimEnd("/")) { $res.Redirect($Base); continue }
      if (-not $path.StartsWith($Base)) { $res.StatusCode = 404; continue }
      $rel = $path.Substring($Base.Length)
      if ($rel -eq "" -or $rel.EndsWith("/")) { $rel += "index.html" }
      $file = [IO.Path]::GetFullPath((Join-Path $Root ($rel -replace "/", "\")))
      if (-not $file.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($file)) {
        $res.StatusCode = 404; continue
      }
      $info = New-Object IO.FileInfo $file
      $etag = '"' + $info.Length.ToString("x") + "-" + $info.LastWriteTimeUtc.Ticks.ToString("x") + '"'
      $type = $mime[$info.Extension.ToLower()]; if (-not $type) { $type = "application/octet-stream" }
      $res.ContentType = $type
      $res.AddHeader("ETag", $etag)
      $res.AddHeader("Cache-Control", "no-cache")
      if ($req.Headers["If-None-Match"] -eq $etag) { $res.StatusCode = 304; continue }
      $res.ContentLength64 = $info.Length
      if ($req.HttpMethod -eq "HEAD") { continue }
      $fs = [IO.File]::OpenRead($file)
      try { $fs.CopyTo($res.OutputStream, 1048576) } finally { $fs.Dispose() }
    } catch {
      # เบราว์เซอร์ยกเลิกคำขอกลางทาง (เปลี่ยนหน้า) — ข้ามไป
    } finally {
      try { $res.Close() } catch {}
    }
  }
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, 8)
$pool.Open()
$jobs = foreach ($i in 1..8) {
  $ps = [PowerShell]::Create()
  $ps.RunspacePool = $pool
  [void]$ps.AddScript($worker).AddArgument($listener).AddArgument($Root).AddArgument($Base)
  [pscustomobject]@{ PS = $ps; Handle = $ps.BeginInvoke() }
}

$url = "http://localhost:$Port$Base"
Write-Host ""
Write-Host "  โมเดลเปิดอยู่ที่  $url" -ForegroundColor Green
Write-Host "  (เบราว์เซอร์จะเปิดให้เอง · ห้ามปิดหน้าต่างนี้ระหว่างใช้งาน · เลิกใช้กด Ctrl+C หรือปิดหน้าต่าง)"
Write-Host ""
if (-not $NoOpen) { Start-Process $url }

try {
  while ($listener.IsListening) { Start-Sleep -Milliseconds 500 }
} finally {
  $listener.Stop(); $listener.Close()
  foreach ($j in $jobs) { try { $j.PS.Dispose() } catch {} }
  $pool.Close()
}
