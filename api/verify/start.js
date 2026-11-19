// GET /api/verify/start — ออก state (cookie ลงนาม) แล้วส่งต่อไปหน้า Discord authorize
import { authorizeUrl } from '../../lib/discord.js';
import { issueState } from '../../lib/state.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  const { state, cookie } = issueState();
  res.setHeader('Set-Cookie', `vs=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.redirect(302, authorizeUrl(state));
}
