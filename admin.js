(function () {
'use strict';
const $ = s => document.querySelector(s);
const TIERS = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5'];
const FRIENDLY = {
  'Heritage Railway Collection': 'Double Side Station Clock',
  'Heritage Wood & Brass Collection': 'Wood & Brass Wall Clock',
  'Hand Painted Table Clock Collection': 'Hand Painted Table Clock',
  'Heritage Canvas Collection': 'Hand Painted Wall Clock'
};
let DATA = null, PW = '', dirty = false, SHOW = 40;

function status(msg, kind) { const s = $('#status'); s.textContent = msg; s.className = 'status ' + (kind || ''); }
function markDirty() { if (!dirty) { dirty = true; status('You have unsaved changes — press “Save changes”.', 'dirty'); } }
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- data prep ---------- */
function ensure(d) {
  delete d.passwords; delete d.adminPassword;            // secrets never live in the catalog data
  d.brand = d.brand || 'ARTIME';
  d.tierLabels = Object.assign({ tier1: 'Price 1', tier2: 'Price 2', tier3: 'Price 3', tier4: 'Price 4', tier5: 'Price 5' }, d.tierLabels || {});
  d.settings = Object.assign({ customerTier: 'tier5', whatsapp: '917229922002', phone: '7229922002', email: 'thetimesandcraftexport@gmail.com' }, d.settings || {});
  d.products = Array.isArray(d.products) ? d.products : [];
  d.products.forEach(p => {
    p.images = [...(p.images || []), '', '', ''].slice(0, 3).map(x => x || '');
    p.prices = p.prices || {};
    TIERS.forEach(t => { if (typeof p.prices[t] !== 'number') p.prices[t] = Number(p.prices[t]) || 0; });
    if (p.active === undefined) p.active = true;
    p.collection = p.collection || 'Other';
  });
  d.categories = Array.isArray(d.categories) ? d.categories : [];
  const seen = new Set(d.categories.map(c => c.key));
  d.products.forEach(p => {
    if (!seen.has(p.collection)) { seen.add(p.collection); d.categories.push({ key: p.collection, label: FRIENDLY[p.collection] || p.collection.replace(/ Collection$/i, '') }); }
  });
  return d;
}

/* ---------- login ---------- */
async function login(pw) {
  $('#gateErr').textContent = 'Checking…';
  try {
    const res = await apiPost('/admin/get', { password: pw });
    if (!res.ok) { $('#gateErr').textContent = res.error || 'Incorrect password.'; return; }
    PW = pw; sessionStorage.setItem('artime_admin_pw', pw);
    DATA = ensure(res.data || {});
    $('#gate').style.display = 'none'; $('#adm').style.display = 'block';
    renderAll();
    if (!res.data) status('Nothing saved yet. Click “Import JSON” and choose your catalog file, then Save.', 'dirty');
    else status('Loaded ' + DATA.products.length + ' products.', 'ok');
  } catch (e) { $('#gateErr').textContent = 'Could not reach the server.'; }
}
$('#loginBtn').addEventListener('click', () => login($('#pw').value.trim()));
$('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') login($('#pw').value.trim()); });
if (sessionStorage.getItem('artime_admin_pw')) login(sessionStorage.getItem('artime_admin_pw'));

/* ---------- render ---------- */
function renderAll() { renderSettings(); renderCats(); renderFilterCats(); renderProducts(); }
function renderSettings() {
  $('#sTier').innerHTML = TIERS.map(t => `<option value="${t}" ${DATA.settings.customerTier === t ? 'selected' : ''}>${esc(DATA.tierLabels[t])}</option>`).join('');
  document.querySelectorAll('[data-s]').forEach(el => { if (el.tagName === 'INPUT') el.value = DATA.settings[el.dataset.s] || ''; });
  $('#tierNames').innerHTML = TIERS.map(t => `<label>${t.replace('tier', 'Column ')}<input data-t="${t}" value="${esc(DATA.tierLabels[t])}"></label>`).join('');
}
function renderCats() {
  const count = k => DATA.products.filter(p => p.collection === k).length;
  $('#cats').innerHTML = DATA.categories.map((c, i) => `
    <div class="catrow"><input data-c="${i}" value="${esc(c.label)}">
      <small>${count(c.key)} pcs</small>
      <button class="btn" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn" data-down="${i}" ${i === DATA.categories.length - 1 ? 'disabled' : ''}>↓</button>
    </div>`).join('');
}
function renderFilterCats() {
  const cur = $('#fcat').value;
  $('#fcat').innerHTML = '<option value="">All categories</option>' + DATA.categories.map(c => `<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('');
  $('#fcat').value = cur;
}
function filtered() {
  const q = $('#q').value.trim().toLowerCase(), c = $('#fcat').value; const out = [];
  DATA.products.forEach((p, i) => {
    if (c && p.collection !== c) return;
    if (q && ![p.code, p.title, p.finish, p.pattern].join(' ').toLowerCase().includes(q)) return;
    out.push(i);
  });
  return out;
}
function renderProducts() {
  const idx = filtered(); $('#pcount').textContent = DATA.products.length;
  $('#plist').innerHTML = idx.slice(0, SHOW).map(i => row(DATA.products[i], i)).join('') || '<p class="n">No products match.</p>';
  $('#more').hidden = idx.length <= SHOW;
  $('#more').textContent = `Show more (${idx.length - SHOW} left)`;
}
function row(p, i) {
  const opts = DATA.categories.map(c => `<option value="${esc(c.key)}" ${c.key === p.collection ? 'selected' : ''}>${esc(c.label)}</option>`).join('');
  const ct = DATA.settings.customerTier;
  const price = TIERS.map(t => `<label class="${t === ct ? 'cust' : ''}">${esc(DATA.tierLabels[t])} ${t === ct ? '<span>★ customer</span>' : ''}<input type="number" min="0" data-i="${i}" data-f="prices.${t}" value="${p.prices[t]}"></label>`).join('');
  const hidden = !(p.prices[ct] > 0) ? '<div class="warn full">Hidden from customers: customer price is 0.</div>' : '';
  return `<div class="arow ${p.active === false ? 'off' : ''}">
    <img class="athumb" src="${esc(p.images[0] || PLACEHOLDER)}" onerror="this.onerror=null;this.src=PLACEHOLDER">
    <div class="agrid">
      <label>Code<input data-i="${i}" data-f="code" value="${esc(p.code)}"></label>
      <label>Category<select data-i="${i}" data-f="collection">${opts}</select></label>
      <label>Size<input data-i="${i}" data-f="size" value="${esc(p.size)}"></label>
      <label>Colour / finish<input data-i="${i}" data-f="finish" value="${esc(p.finish)}"></label>
      <label class="w2">Title<input data-i="${i}" data-f="title" value="${esc(p.title)}"></label>
      ${price}
      ${[0, 1, 2].map(k => `<label class="${k === 0 ? 'w2' : ''}">Photo ${k + 1}${k === 0 ? ' (main)' : ''}<input data-i="${i}" data-f="images.${k}" value="${esc(p.images[k])}"></label>`).join('')}
      ${hidden}
      <div class="acts full"><label><input type="checkbox" data-i="${i}" data-f="active" ${p.active !== false ? 'checked' : ''}> Visible to customers</label>
      <button class="btn danger" data-del="${i}">Delete</button></div>
    </div></div>`;
}

/* ---------- editing ---------- */
function setPath(obj, path, v) { const k = path.split('.'); let o = obj; while (k.length > 1) o = o[k.shift()]; o[k[0]] = v; }
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.f !== undefined && t.dataset.i !== undefined) {
    const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) || 0 : t.value;
    setPath(DATA.products[+t.dataset.i], t.dataset.f, v); markDirty();
    const rowEl = t.closest('.arow');
    if (t.dataset.f === 'active') rowEl.classList.toggle('off', !v);
    if (t.dataset.f === 'images.0') rowEl.querySelector('.athumb').src = v || PLACEHOLDER;
  } else if (t.dataset.s) { DATA.settings[t.dataset.s] = t.value; markDirty(); if (t.dataset.s === 'customerTier') renderProducts(); }
  else if (t.dataset.t) { DATA.tierLabels[t.dataset.t] = t.value; markDirty(); }
  else if (t.dataset.c !== undefined) { DATA.categories[+t.dataset.c].label = t.value; markDirty(); }
});
$('#tierNames').addEventListener('change', () => { renderSettings(); renderProducts(); });
$('#cats').addEventListener('change', renderFilterCats);
$('#cats').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const c = DATA.categories;
  if (b.dataset.up !== undefined) { const i = +b.dataset.up;[c[i - 1], c[i]] = [c[i], c[i - 1]]; }
  else if (b.dataset.down !== undefined) { const i = +b.dataset.down;[c[i + 1], c[i]] = [c[i], c[i + 1]]; }
  else return;
  markDirty(); renderCats(); renderFilterCats();
});
$('#addCat').addEventListener('click', () => {
  const label = (prompt('New category name (shown as a tab):') || '').trim(); if (!label) return;
  if (DATA.categories.some(c => c.key === label)) { alert('That category already exists.'); return; }
  DATA.categories.push({ key: label, label }); markDirty(); renderCats(); renderFilterCats(); renderProducts();
});
$('#plist').addEventListener('click', e => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  const p = DATA.products[+b.dataset.del];
  if (!confirm('Delete ' + p.code + '? This cannot be undone after saving.')) return;
  DATA.products.splice(+b.dataset.del, 1); markDirty(); renderCats(); renderProducts();
});
$('#addProd').addEventListener('click', () => {
  const c = $('#fcat').value || (DATA.categories[0] && DATA.categories[0].key) || 'Other';
  DATA.products.unshift({ code: 'NEW-' + Date.now().toString().slice(-5), collection: c, finish: '', pattern: '', size: '', title: '', description: '', highlights: [], images: ['', '', ''], prices: { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 }, active: true });
  $('#q').value = ''; markDirty(); renderCats(); renderProducts(); window.scrollTo({ top: $('#plist').offsetTop - 120, behavior: 'smooth' });
});
$('#q').addEventListener('input', () => { SHOW = 40; renderProducts(); });
$('#fcat').addEventListener('change', () => { SHOW = 40; renderProducts(); });
$('#more').addEventListener('click', () => { SHOW += 40; renderProducts(); });

/* ---------- save / import / export / telegram ---------- */
$('#saveBtn').addEventListener('click', async () => {
  const codes = new Set();
  for (const p of DATA.products) {
    const c = String(p.code || '').trim();
    if (!c) { alert('A product has an empty code. Please fix it first.'); return; }
    if (codes.has(c)) { alert('Duplicate product code: ' + c); return; }
    codes.add(c); p.code = c;
  }
  status('Saving…');
  try {
    const res = await apiPost('/admin/save', { password: PW, data: DATA });
    if (!res.ok) { status(res.error || 'Save failed.', 'err'); return; }
    dirty = false; status('Saved ✓ — customers will see the new catalog on their next refresh.', 'ok');
  } catch (e) { status('Could not reach the server.', 'err'); }
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || !Array.isArray(d.products)) throw new Error('no products');
    if (DATA.products.length && !confirm('Replace the current ' + DATA.products.length + ' products with ' + d.products.length + ' from this file?')) return;
    DATA = ensure(d); renderAll(); markDirty();
    status('Imported ' + DATA.products.length + ' products. Review, then press “Save changes”.', 'dirty');
  } catch (err) { alert('That file is not a valid catalog JSON.'); }
  e.target.value = '';
});
$('#exportBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' }));
  a.download = 'artime-catalog-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
});
$('#tgBtn').addEventListener('click', async () => {
  status('Sending test message…');
  try {
    const r = await apiPost('/admin/test-telegram', { password: PW });
    status(r.ok ? 'Telegram works ✓ — check your chat.' : 'Telegram failed: ' + (r.error || 'unknown error'), r.ok ? 'ok' : 'err');
  } catch (e) { status('Could not reach the server.', 'err'); }
});
})();
