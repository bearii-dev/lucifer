// GET /api/oauth/callback — รับผลจาก Discord: ตรวจ state → แลก code → ยืนยันตัวตน → เพิ่มเข้าเซิร์ฟเวอร์ → เพิกถอน token
import { addMember, exchangeCode, identity, revoke } from '../../lib/discord.js';
import { page, readCookie } from '../../lib/html.js';
import { verifyState } from '../../lib/state.js';

export default async function handler(req, res) {
  const send = (status, opts) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Set-Cookie', 'vs=; Path=/; Max-Age=0'); // ล้าง state cookie เสมอ (ใช้ครั้งเดียว)
    res.status(status).send(page(opts));
  };

  try {
    if (req.method !== 'GET') return send(405, { kind: 'error', heading: 'ไม่รองรับ', message: 'เมธอดไม่ถูกต้อง' });

    const { code, state, error } = req.query;
    if (error) return send(400, { kind: 'warning', heading: 'ยกเลิกแล้ว', message: 'คุณไม่ได้อนุญาต จึงไม่มีการเข้าร่วมใด ๆ' });
    if (!code || !state) return send(400, { kind: 'error', heading: 'ลิงก์ไม่ถูกต้อง', message: 'ไม่พบข้อมูลที่จำเป็น โปรดเริ่มใหม่' });

    // CSRF/หมดอายุ: cookie ลงนามต้องตรงกับ state ใน URL
    if (!verifyState(state, readCookie(req, 'vs'))) {
      return send(400, { kind: 'warning', heading: 'ลิงก์หมดอายุ', message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง โปรดเริ่ม verify ใหม่' });
    }

    const token = await exchangeCode(code);
    const me = await identity(token.access_token);

    let result;
    try {
      result = await addMember(me.id, token.access_token);
    } finally {
      await revoke(token.access_token); // เพิกถอน token ทิ้งทันที
    }

    return result === 'already_member'
      ? send(200, { kind: 'info', heading: 'คุณเป็นสมาชิกอยู่แล้ว', message: 'คุณอยู่ในเซิร์ฟเวอร์นี้อยู่แล้ว ไม่ต้องทำอะไรเพิ่ม' })
      : send(200, { kind: 'success', heading: 'ยืนยันสำเร็จ! 🎉', message: 'คุณเข้าร่วมเซิร์ฟเวอร์เรียบร้อยแล้ว — กลับไปที่ Discord ได้เลย' });
  } catch {
    return send(500, { kind: 'error', heading: 'เกิดข้อผิดพลาด', message: 'โปรดลองใหม่อีกครั้งภายหลัง' }); // ไม่ log/คืนค่า code/token
  }
}
