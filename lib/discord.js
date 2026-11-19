// เรียก Discord REST สำหรับ OAuth2 (identify) + ให้ยศ (อ่านค่าลับจาก environment ของ Vercel)
//   flow: authorize (identify) → รู้ว่าใคร → ให้ยศ ROLE_ID ในเซิร์ฟเวอร์ GUILD_ID ด้วย bot token
//   ไม่ใช้ guilds.join แล้ว — ผู้ใช้อยู่ในเซิร์ฟเวอร์อยู่แล้ว เราแค่ให้ยศ
const API = 'https://discord.com/api/v10';
const TIMEOUT_MS = 10_000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // เซิร์ฟเวอร์ที่ให้ยศ
const ROLE_ID = process.env.VERIFY_ROLE_ID; // ยศที่จะให้เมื่อยืนยันสำเร็จ

const call = (path, options) => fetch(`${API}${path}`, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });

export function authorizeUrl(state) {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'identify'); // แค่พิสูจน์ว่าเป็นบัญชีจริง/เจ้าของ
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export async function exchangeCode(code) {
  const res = await call('/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = await res.json();
  if (!new Set((data.scope ?? '').split(' ')).has('identify')) throw new Error('ไม่มี scope identify');
  return data;
}

export async function identity(accessToken) {
  const res = await call('/users/@me', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`identity failed: ${res.status}`);
  return res.json();
}

/**
 * ให้ยศแก่สมาชิก (ผู้ใช้ต้องอยู่ในเซิร์ฟเวอร์อยู่แล้ว) ด้วย bot token
 * @returns {'ok'}
 */
export async function addRole(userId) {
  const res = await call(`/guilds/${GUILD_ID}/members/${userId}/roles/${ROLE_ID}`, {
    method: 'PUT',
    headers: { authorization: `Bot ${BOT_TOKEN}` },
  });
  if (res.status === 204) return 'ok'; // สำเร็จ (idempotent: มียศอยู่แล้วก็ 204)
  if (res.status === 404) throw new Error('not_member'); // ยังไม่ได้อยู่ในเซิร์ฟเวอร์
  const text = await res.text().catch(() => '');
  throw new Error(`add role failed: ${res.status} ${text.slice(0, 200)}`);
}

export async function revoke(token) {
  await call('/oauth2/token/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, token }),
  }).catch(() => {});
}
