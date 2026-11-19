# Bloodline Verify Web (Vercel)

เว็บ OAuth2 verify แบบ serverless — ผู้ใช้ **authorize (identify) แล้วได้ยศ** (ไม่ใช่ join)
ตัวบอท (gateway) ยังต้องรันบน host ปกติเหมือนเดิม เว็บนี้ทำหน้าที่ยืนยันตัวตนฝั่งเว็บเท่านั้น

## โครงสร้าง

```
vercel/
├─ index.html            หน้า Landing (เสิร์ฟที่ /)
├─ api/
│  ├─ verify/start.js     GET /api/verify/start  → ออก state (cookie) แล้ว redirect ไป Discord
│  └─ oauth/callback.js   GET /api/oauth/callback → ตรวจ state → แลก code → identify → ให้ยศ → เพิกถอน token
└─ lib/                   state (HMAC), discord REST, html
```

## flow
1. ปุ่ม verify ในบอท (หรือเข้าหน้านี้ตรง ๆ) → กด "ยืนยันด้วย Discord"
2. `/api/verify/start` ออก state (cookie ลงนาม) แล้วพาไปหน้า Discord authorize (scope `identify` อย่างเดียว)
3. ผู้ใช้อนุญาต → `/api/oauth/callback` ตรวจ state → แลก code → รู้ว่าใคร → **ให้ยศ `VERIFY_ROLE_ID` ในเซิร์ฟเวอร์ `DISCORD_GUILD_ID`** ด้วย bot token → เพิกถอน token
4. ผู้ใช้ต้องอยู่ในเซิร์ฟเวอร์อยู่แล้ว (ถ้ายังไม่อยู่ จะขึ้นให้เข้าก่อน)

## ทำไมต้องรื้อจากเวอร์ชันในบอท
Serverless ไม่มีหน่วยความจำค้าง จึง:
- **state** ใช้ **HMAC-signed cookie** (double-submit กัน CSRF) + หมดอายุ 10 นาที แทน Map ในหน่วยความจำ
- **กัน replay** อาศัย authorization code ของ Discord ที่ใช้ได้ครั้งเดียว (ยิง callback ซ้ำ → exchange ไม่ผ่าน)

## Deploy

1. เชื่อม GitHub repo กับ Vercel (Root Directory = `./`) หรือ `npx vercel` ในโฟลเดอร์นี้
2. ตั้ง Environment Variables ตาม [.env.example](.env.example):
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID` (เซิร์ฟเวอร์ที่ให้ยศ), `VERIFY_ROLE_ID` (ยศที่จะให้)
   - `OAUTH_REDIRECT_URI` = `https://<โดเมน Vercel>/api/oauth/callback`
   - `OAUTH_STATE_SECRET` = `openssl rand -base64 48`
3. Discord Developer Portal → OAuth2 → **Redirects** → ใส่ค่าเท่ากับ `OAUTH_REDIRECT_URI` เป๊ะ ๆ
4. บอทต้องอยู่ในเซิร์ฟเวอร์ `DISCORD_GUILD_ID` + มีสิทธิ์ **Manage Roles** + **ยศบอทอยู่เหนือยศที่จะให้**
5. ในบอทตั้ง `verify.webUrl` ใน `src/config/bot.config.js` = `https://<โดเมน Vercel>/` เพื่อให้ปุ่ม verify ลิงก์มาที่นี่

เสร็จแล้วเข้าหน้าแรก → กด "ยืนยันด้วย Discord" → อนุญาตบน Discord → ได้ยศ → เด้งหน้าแสดงผล

## ข้อควรระวังด้านความปลอดภัย
- **bot token อยู่บน Vercel** = สิทธิ์เต็มของบอทอยู่บน third party ใส่เป็น Encrypted env เท่านั้น อย่า commit
- ใช้ HTTPS ของ Vercel อยู่แล้ว; cookie เป็น `HttpOnly; Secure; SameSite=Lax`
- ขอ scope `identify` อย่างเดียว และให้ยศ **เฉพาะ `VERIFY_ROLE_ID` ในเซิร์ฟเวอร์ `DISCORD_GUILD_ID`** ค่าเดียว

## ข้อจำกัด
- การให้ยศทางเว็บนี้ **ไม่ถูกบันทึกใน SQLite ของบอท** → `/verify-stats` บนบอทจะไม่นับ (ถ้าต้องการให้เห็น ขอเพิ่ม webhook/ DB กลางได้)
- `prompt=consent` บังคับยืนยันทุกครั้ง จึงไม่มีการ reuse สิทธิ์
