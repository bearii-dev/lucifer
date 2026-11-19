// state แบบ stateless (ไม่พึ่งหน่วยความจำ/ฐานข้อมูล) สำหรับ serverless
//   issueState() → คืน { state, cookie }: state ใส่ใน URL, cookie เซ็ตเป็น HttpOnly
//   verifyState() → ตรวจว่า cookie ลงนามถูกต้อง + ตรงกับ state ใน URL (double-submit กัน CSRF) + ไม่หมดอายุ
// กัน replay: ตัว authorization code ของ Discord ใช้ได้ครั้งเดียว ยิงซ้ำจะ exchange ไม่ผ่านเอง
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.OAUTH_STATE_SECRET || process.env.DISCORD_CLIENT_SECRET || '';
const MAX_AGE_MS = 10 * 60_000;

const sign = (value) => createHmac('sha256', SECRET).update(value).digest('base64url');

export function issueState() {
  const nonce = randomBytes(18).toString('base64url');
  const issued = Date.now().toString(36);
  const payload = `${nonce}.${issued}`;
  return { state: nonce, cookie: `${payload}.${sign(payload)}` };
}

export function verifyState(queryState, cookie) {
  if (!SECRET || !queryState || !cookie) return false;
  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const [nonce, issued, sig] = parts;

  const expected = sign(`${nonce}.${issued}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false; // ลายเซ็นไม่ตรง = ไม่ใช่ของเรา (CSRF)
  if (nonce !== queryState) return false; // double-submit: cookie ต้องตรงกับ state ใน URL

  const ts = Number.parseInt(issued, 36);
  return Number.isFinite(ts) && Date.now() - ts <= MAX_AGE_MS; // หมดอายุ
}
