// หน้าเว็บผลลัพธ์ (ธีมเดียวกับหน้า Landing) — ไม่สะท้อนค่าจากผู้ใช้ (กัน XSS) ไม่มีข้อมูลลับ
const ACCENTS = { success: '#22c55e', info: '#8b5cf6', warning: '#f59e0b', error: '#ef4444' };
const ICONS = { success: '✅', info: '💜', warning: '⚠️', error: '⚠️' };

export function page({ kind = 'error', heading, message }) {
  const accent = ACCENTS[kind] ?? ACCENTS.error;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${heading}</title>
<style>
  :root { color-scheme: dark; --accent:${accent}; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
         background:radial-gradient(1200px 600px at 50% -10%, #1b1430 0%, #0b0b0f 60%); color:#e7e7ee; }
  .card { max-width:460px; width:100%; background:#15151d; border:1px solid #2a2a35; border-radius:20px;
          padding:40px 30px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.5); }
  .dot { width:72px; height:72px; border-radius:50%; margin:0 auto 22px; display:grid; place-items:center;
         font-size:34px; background:color-mix(in srgb, var(--accent) 16%, transparent);
         border:1px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  h1 { margin:0 0 12px; font-size:1.35rem; color:var(--accent); }
  p { margin:0; color:#b6b6c4; line-height:1.7; font-size:.98rem; }
  .hint { margin-top:22px; font-size:.82rem; color:#6b6b7b; }
</style></head>
<body><main class="card"><div class="dot">${ICONS[kind] ?? '⚠️'}</div>
<h1>${heading}</h1><p>${message}</p>
<p class="hint">กลับไปที่ Discord ได้เลย — ปิดหน้านี้ได้</p></main></body></html>`;
}

export function readCookie(req, name) {
  const raw = req.headers?.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
