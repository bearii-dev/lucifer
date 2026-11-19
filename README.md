# Lucifer Verify Web (Vercel)

เว็บ OAuth2 verify & join แบบ serverless สำหรับบอท Lucifer — แยก callback ออกมาจากตัวบอท
ตัวบอท (gateway) ยังต้องรันบน host ปกติเหมือนเดิม เว็บนี้ทำหน้าที่ onboarding ฝั่งเว็บเท่านั้น

## โครงสร้าง

```
vercel/
├─ index.html            หน้า Landing (เสิร์ฟที่ /)
├─ api/
│  ├─ verify/start.js     GET /api/verify/start  → ออก state (cookie) แล้ว redirect ไป Discord
│  └─ oauth/callback.js   GET /api/oauth/callback → ตรวจ state → แลก code → เพิ่มสมาชิก → เพิกถอน token
└─ lib/                   state (HMAC), discord REST, html
```

## ทำไมต้องรื้อจากเวอร์ชันในบอท
Serverless ไม่มีหน่วยความจำค้างและเข้า SQLite ของบอทไม่ได้ จึง:
- **state** ใช้ **HMAC-signed cookie** (double-submit กัน CSRF) + หมดอายุ 10 นาที แทน Map ในหน่วยความจำ
- **กัน replay** อาศัย authorization code ของ Discord ที่ใช้ได้ครั้งเดียว (ยิง callback ซ้ำ → exchange ไม่ผ่าน)
- **ไม่มีการบันทึกสถานะลง SQLite** ของบอท → `/verify-stats` บนบอทจะไม่นับการเข้าร่วมที่มาทางเว็บนี้ (ดู "ข้อจำกัด")

## Deploy

1. ติดตั้ง CLI แล้วรันในโฟลเดอร์นี้: `npx vercel` (หรือเชื่อม GitHub repo แล้วตั้ง Root Directory = `vercel/`)
2. ตั้ง Environment Variables ตาม [.env.example](.env.example):
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`
   - `DESTINATION_GUILD_ID`
   - `OAUTH_REDIRECT_URI` = `https://<โดเมน Vercel>/api/oauth/callback`
   - `OAUTH_STATE_SECRET` = `openssl rand -base64 48`
3. Discord Developer Portal → OAuth2 → **Redirects** → ใส่ค่าเท่ากับ `OAUTH_REDIRECT_URI` เป๊ะ ๆ
4. เอาบอทเข้าเซิร์ฟเวอร์ปลายทาง + ให้สิทธิ์ **Create Instant Invite**
5. (ถ้าใช้ปุ่มในบอท) ตั้ง `authorizedJoin.webUrl` ใน `src/config/bot.config.js` = `https://<โดเมน Vercel>/` เพื่อให้ปุ่ม Join ลิงก์มาที่นี่

เสร็จแล้วเข้าหน้าแรก → กด "ยืนยันด้วย Discord" → อนุญาตบน Discord → เด้งกลับหน้าแสดงผล

## ข้อควรระวังด้านความปลอดภัย
- **bot token อยู่บน Vercel** = สิทธิ์เต็มของบอทอยู่บน third party ใส่เป็น Encrypted env เท่านั้น อย่า commit
- ใช้ HTTPS ของ Vercel อยู่แล้ว; cookie เป็น `HttpOnly; Secure; SameSite=Lax`
- เพิ่มสมาชิกเข้า **เฉพาะ `DESTINATION_GUILD_ID`** ค่าเดียวเท่านั้น

## ข้อจำกัด
- การเข้าร่วมทางเว็บนี้ **ไม่ถูกบันทึกใน SQLite ของบอท** → `/verify-status`, `/verify-stats` จะไม่เห็นข้อมูลนี้
  (ถ้าต้องการให้เห็น ต้องเพิ่ม webhook จาก callback กลับไปหาบอท หรือใช้ DB กลาง — ขอเพิ่มได้)
- `prompt=consent` บังคับยืนยันทุกครั้ง จึงไม่มีการ reuse สิทธิ์
