#!/bin/bash
# ติดตั้งครั้งแรกบนเครื่องใหม่ (macOS) — คู่กับ ติดตั้งครั้งแรก.cmd ของ Windows
#   1. Node.js 22+          ไม่มี/รุ่นเก่า = brew install node
#   2. Python 3.11+         ไม่มี = brew install python@3.12
#   3. etl/.venv            สร้าง venv + pip install -r etl/requirements.txt (plugin ETL ของ vite หา python จาก etl/.venv/bin/python)
#   4. app/node_modules     npm ci (lockfile commit ไว้แล้ว)
# ทุกขั้นข้ามถ้าทำไว้แล้ว — กดซ้ำได้ไม่เสียหาย
# วิธีใช้: ดับเบิลคลิกไฟล์นี้ · ถ้า macOS ไม่ยอมเปิด ให้เปิด Terminal พิมพ์ sh เว้นวรรค ลากไฟล์นี้มาวาง แล้วกด Enter
# ★ ไฟล์นี้ต้องเป็น LF (ไม่ใช่ CRLF) — .gitattributes บังคับไว้แล้ว

say()  { printf '\n\033[36m== %s\033[0m\n' "$1"; }
ok()   { printf '   \033[32m✓ %s\033[0m\n' "$1"; }
warn() { printf '   \033[33m! %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1"; printf '\nกด Enter เพื่อปิด'; read -r _; exit 1; }

# หารากโปรเจกต์ = โฟลเดอร์ที่มี app/package.json และ etl/requirements.txt (ไล่ขึ้นจากที่อยู่ของสคริปต์)
ROOT="$(cd "$(dirname "$0")" && pwd)"
while [ "$ROOT" != "/" ] && ! { [ -f "$ROOT/app/package.json" ] && [ -f "$ROOT/etl/requirements.txt" ]; }; do
  ROOT="$(dirname "$ROOT")"
done
[ "$ROOT" = "/" ] && fail "หาโฟลเดอร์โปรเจกต์ไม่เจอ — วางโฟลเดอร์ คู่มือการ Deploy ไว้ในโปรเจกต์ตามเดิม"
echo "โปรเจกต์: $ROOT"

# Homebrew ติดตั้งไว้ได้สองที่ (Apple Silicon / Intel) — หน้าต่างที่เปิดจากดับเบิลคลิกอาจยังไม่รู้จัก PATH
for b in /opt/homebrew/bin /usr/local/bin; do
  [ -x "$b/brew" ] && eval "$("$b/brew" shellenv)"
done

brew_install() {
  if ! command -v brew >/dev/null 2>&1; then
    fail "เครื่องนี้ไม่มี Homebrew — ติดตั้งจาก https://brew.sh (หรือดาวน์โหลด $2 เองจาก $3) แล้วดับเบิลคลิกไฟล์นี้ใหม่"
  fi
  echo "   กำลังติดตั้ง $2 ผ่าน Homebrew..."
  brew install "$1" || warn "brew ตอบว่าไม่สำเร็จ — ตรวจผลด้านล่าง"
  hash -r
}

# ---------------------------------------------------------------- 1. Node.js
say "1/4 Node.js 22+"
node_major() { node -v 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p'; }
nm="$(node_major)"
if [ "${nm:-0}" -ge 22 ]; then ok "มีแล้ว ($(node -v))"
else
  [ -n "$nm" ] && warn "รุ่นเดิม v$nm เก่าเกินไป"
  brew_install node "Node.js" "https://nodejs.org"
  nm="$(node_major)"
  [ "${nm:-0}" -ge 22 ] && ok "ติดตั้งแล้ว ($(node -v))" || fail "ยังไม่เจอ Node.js 22+ — ปิดหน้าต่างนี้แล้วเปิดไฟล์นี้ใหม่"
fi

# ---------------------------------------------------------------- 2. Python
say "2/4 Python 3.11+"
# คืนชื่อคำสั่ง python 3.11+ ตัวแรกที่ใช้ได้ — python3 ของ Apple (Command Line Tools) มักเป็น 3.9 ใช้ไม่ได้
find_py() {
  for p in python3.13 python3.12 python3.11 python3; do
    command -v "$p" >/dev/null 2>&1 || continue
    if "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then echo "$p"; return; fi
  done
}
PY="$(find_py)"
if [ -n "$PY" ]; then ok "มีแล้ว ($("$PY" --version))"
else
  brew_install python@3.12 "Python 3.12" "https://www.python.org/downloads/"
  PY="$(find_py)"
  [ -n "$PY" ] && ok "ติดตั้งแล้ว ($("$PY" --version))" || fail "ยังไม่เจอ Python 3.11+ — ปิดหน้าต่างนี้แล้วเปิดไฟล์นี้ใหม่"
fi

# ---------------------------------------------------------------- 3. etl/.venv
say "3/4 แพ็กเกจ ETL ใน etl/.venv"
VPY="$ROOT/etl/.venv/bin/python"
if [ ! -x "$VPY" ]; then
  echo "   สร้าง venv..."
  "$PY" -m venv "$ROOT/etl/.venv" && [ -x "$VPY" ] || fail "สร้าง etl/.venv ไม่สำเร็จ"
fi
if "$VPY" -c "import openpyxl, python_calamine" 2>/dev/null; then ok "มีแพ็กเกจครบแล้ว"
else
  echo "   pip install -r etl/requirements.txt ..."
  "$VPY" -m pip install --upgrade pip --quiet --disable-pip-version-check
  "$VPY" -m pip install -r "$ROOT/etl/requirements.txt" --disable-pip-version-check || fail "ติดตั้งแพ็กเกจ ETL ไม่สำเร็จ — ดูข้อความ pip ด้านบน"
  ok "ติดตั้งแพ็กเกจแล้ว"
fi

# ---------------------------------------------------------------- 4. npm ci
say "4/4 แพ็กเกจของเว็บ (app/node_modules)"
if [ -x "$ROOT/app/node_modules/.bin/vite" ]; then ok "มีแล้ว"
else
  (cd "$ROOT/app" && npm ci) || fail "npm ci ไม่สำเร็จ — ดูข้อความด้านบน"
  ok "ติดตั้งแล้ว"
fi

printf '\n\033[32mเสร็จแล้ว ✓\033[0m\n'
echo "เปิดโมเดล: เปิด Terminal ในโฟลเดอร์ app แล้วพิมพ์  npm run dev   → http://localhost:5173/fleet-cost-model/"
echo "ดูคำสั่งอื่นใน คู่มือการ Deploy/โค้ดที่ต้องใส่หลังเปิด folder.txt"
printf '\nกด Enter เพื่อปิด'; read -r _
