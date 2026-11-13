/**
 * ARTIME catalog backend (Cloudflare Worker)
 *
 * Bindings / secrets you must set (see SETUP.md):
 *   KV namespace  : CATALOG
 *   Secret        : ADMIN_PASSWORD
 *   Secret        : TELEGRAM_BOT_TOKEN
 *   Secret        : TELEGRAM_CHAT_ID      (one id, or several separated by commas)
 *
 * Routes
 *   GET  /catalog              public - products with ONLY the customer price
 *   POST /order                public - receives the order PDF and forwards it to Telegram
 *   POST /admin/get            admin  - full catalog data
 *   POST /admin/save           admin  - save catalog data
 *   POST /admin/test-telegram  admin  - sends a test message
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const json = (o, status = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function isAdmin(env, pw) {
  if (!env.ADMIN_PASSWORD || !pw) return false;
  return (await sha(pw)) === (await sha(env.ADMIN_PASSWORD));
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/catalog' && req.method === 'GET') return catalog(env);
      if (path === '/order' && req.method === 'POST') return order(req, env);
      if (path.startsWith('/admin/') && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        if (!(await isAdmin(env, body.password))) return json({ ok: false, error: 'Incorrect password.' }, 401);
        if (path === '/admin/get') {
          const raw = await env.CATALOG.get('data');
          return json({ ok: true, data: raw ? JSON.parse(raw) : null });
        }
        if (path === '/admin/save') {
          const d = body.data;
          if (!d || !Array.isArray(d.products)) return json({ ok: false, error: 'Invalid data.' }, 400);
          delete d.passwords; delete d.adminPassword;
          await env.CATALOG.put('data', JSON.stringify(d));
          return json({ ok: true });
        }
        if (path === '/admin/test-telegram') {
          const r = await tgMessage(env, '✅ ARTIME catalog: Telegram is connected.');
          return json(r.ok ? { ok: true } : { ok: false, error: r.error });
        }
      }
    } catch (e) {
      return json({ ok: false, error: 'Server error' }, 500);
    }
    return json({ ok: false, error: 'Not found' }, 404);
  }
};

/* ---------- public catalog ---------- */
async function catalog(env) {
  const raw = await env.CATALOG.get('data');
  if (!raw) return json({ ok: true, empty: true });
  const d = JSON.parse(raw);
  const tier = (d.settings && d.settings.customerTier) || 'tier5';
  const products = (d.products || [])
    .filter(p => p.active !== false)
    .map(p => ({
      code: p.code, title: p.title, collection: p.collection || '', finish: p.finish || '', pattern: p.pattern || '',
      size: p.size || '', images: (p.images || []).filter(Boolean), price: Number(p.prices && p.prices[tier]) || 0
    }))
    .filter(p => p.price > 0);
  const s = d.settings || {};
  return json({
    ok: true,
    brand: d.brand || 'ARTIME',
    settings: { whatsapp: s.whatsapp || '', phone: s.phone || '', email: s.email || '' },
    categories: d.categories || [],
    products
  }, 200, { 'Cache-Control': 'public, max-age=60' });
}

/* ---------- Telegram ---------- */
function chatIds(env) { return String(env.TELEGRAM_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean); }
async function tgMessage(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatIds(env).length) return { ok: false, error: 'Telegram secrets are not set.' };
  for (const id of chatIds(env)) {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: id, text })
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) return { ok: false, error: j.description || 'Telegram rejected the message.' };
  }
  return { ok: true };
}
async function order(req, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatIds(env).length) return json({ ok: false, error: 'Server not configured.' }, 500);
  const fd = await req.formData();
  const name = String(fd.get('name') || '').trim().slice(0, 80);
  const phone = String(fd.get('phone') || '').replace(/\D/g, '');
  const note = String(fd.get('note') || '').trim().slice(0, 200);
  const no = String(fd.get('orderNo') || '').slice(0, 30);
  const pieces = String(fd.get('pieces') || '').slice(0, 8);
  const total = String(fd.get('total') || '').slice(0, 12);
  const summary = String(fd.get('summary') || '');
  const pdf = fd.get('pdf');
  if (name.length < 2 || !/^\d{10,13}$/.test(phone)) return json({ ok: false, error: 'Invalid name or phone.' }, 400);
  if (!pdf || typeof pdf === 'string' || pdf.size < 500 || pdf.size > 10 * 1024 * 1024) return json({ ok: false, error: 'Invalid PDF.' }, 400);

  let caption = `🛒 NEW ORDER ${no}\n👤 ${name}\n📞 ${phone}\n📦 ${pieces} pcs · ₹${Number(total).toLocaleString('en-IN')} + GST` +
    (note ? `\n📝 ${note}` : '') + `\n\n${summary}`;
  if (caption.length > 1000) caption = caption.slice(0, 990) + '\n…(see PDF)';

  for (const id of chatIds(env)) {
    const out = new FormData();
    out.append('chat_id', id);
    out.append('caption', caption);
    out.append('document', new File([await pdf.arrayBuffer()], `ARTIME-Order-${no || 'new'}.pdf`, { type: 'application/pdf' }));
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, { method: 'POST', body: out });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) return json({ ok: false, error: 'Telegram error: ' + (j.description || r.status) }, 502);
  }
  return json({ ok: true });
}
