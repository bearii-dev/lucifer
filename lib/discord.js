// เรียก Discord REST สำหรับ OAuth2 + Add Guild Member (อ่านค่าลับจาก environment ของ Vercel)
const API = 'https://discord.com/api/v10';
const TIMEOUT_MS = 10_000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI;
const DESTINATION_GUILD_ID = process.env.DESTINATION_GUILD_ID;

const call = (path, options) => fetch(`${API}${path}`, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });

export function authorizeUrl(state) {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'identify guilds.join');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'consent'); // ยืนยันสิทธิ์ใหม่ทุกครั้ง ไม่ reuse
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
  const scopes = new Set((data.scope ?? '').split(' '));
  if (!scopes.has('guilds.join') || !scopes.has('identify')) throw new Error('scope ไม่ครบ');
  return data;
}

export async function identity(accessToken) {
  const res = await call('/users/@me', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`identity failed: ${res.status}`);
  return res.json();
}

/** @returns {'joined'|'already_member'} */
export async function addMember(userId, accessToken) {
  const res = await call(`/guilds/${DESTINATION_GUILD_ID}/members/${userId}`, {
    method: 'PUT',
    headers: { authorization: `Bot ${BOT_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (res.status === 201) return 'joined';
  if (res.status === 204) return 'already_member';
  const text = await res.text().catch(() => '');
  throw new Error(`add member failed: ${res.status} ${text.slice(0, 200)}`);
}

export async function revoke(token) {
  await call('/oauth2/token/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, token }),
  }).catch(() => {});
}
