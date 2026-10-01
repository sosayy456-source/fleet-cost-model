#!/bin/sh
# เปิดโมเดลบน Mac ที่ http://localhost:4174/fleet-cost-model/ — ใช้ python3 หรือ ruby ที่มากับเครื่อง ไม่ต้องติดตั้งเพิ่ม
# วิธีใช้: เปิด Terminal พิมพ์  sh  เว้นวรรค แล้วลากไฟล์นี้ใส่หน้าต่าง กด Enter
# (zip ที่ทำบน Windows ไม่เก็บสิทธิ์รันไฟล์ จึงต้องสั่งผ่าน sh ไม่ใช่ดับเบิลคลิก)

cd "$(dirname "$0")/site" || exit 1
if [ ! -f fleet-cost-model/index.html ]; then
  echo "ไม่พบ site/fleet-cost-model/index.html — คลายไฟล์ zip ให้ครบทั้งโฟลเดอร์ก่อน"
  exit 1
fi

# หาพอร์ตว่าง เริ่ม 4174
PORT=4174
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
URL="http://localhost:$PORT/fleet-cost-model/"

# python3 ของ Mac บางเครื่องเป็นแค่ตัวชวนติดตั้ง Command Line Tools — ลองรันจริงก่อน ใช้ไม่ได้ค่อยถอยไป ruby
if python3 -c "import http.server" >/dev/null 2>&1; then
  SERVE="python3 -m http.server $PORT --bind 127.0.0.1"
elif ruby -e "require 'webrick'" >/dev/null 2>&1; then
  SERVE="ruby -run -e httpd . -p $PORT -b 127.0.0.1"
else
  echo "เครื่องนี้ไม่มี python3 หรือ ruby ที่ใช้ได้"
  echo "ติดตั้ง Command Line Tools ก่อน: พิมพ์  xcode-select --install  แล้วรันไฟล์นี้ใหม่"
  exit 1
fi

echo ""
echo "  โมเดลเปิดอยู่ที่  $URL"
echo "  (เบราว์เซอร์จะเปิดให้เอง · ห้ามปิดหน้าต่างนี้ระหว่างใช้งาน · เลิกใช้กด Control+C)"
echo ""
(sleep 1.5; open "$URL") &
exec $SERVE
