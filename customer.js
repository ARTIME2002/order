(function () {
'use strict';
const $ = s => document.querySelector(s);
const LS_CART = 'artime_cart_v2', LS_DATA = 'artime_catalog_v2', LS_CUST = 'artime_customer_v1';

let DATA = null, BY = {}, CAT = '', Q = '', CART = [], LAST = null, deferredPrompt = null;
let lbImgs = [], lbIdx = 0;

/* ---------- helpers ---------- */
const sizeTxt = s => String(s || '').replace(/\*/g, ' × ');
const mainImg = p => (p.images && p.images[0]) || PLACEHOLDER;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}
function loadCart() { try { CART = JSON.parse(localStorage.getItem(LS_CART) || '[]'); } catch (e) { CART = []; } }
function saveCart() { localStorage.setItem(LS_CART, JSON.stringify(CART)); updateBar(); updateBadges(); }
function lines() { return CART.map(i => ({ p: BY[i.code], qty: i.qty })).filter(l => l.p && l.qty > 0); }
function totals() {
  const L = lines();
  return { pcs: L.reduce((n, l) => n + l.qty, 0), total: L.reduce((s, l) => s + l.p.price * l.qty, 0) };
}
function addToCart(code, qty) {
  const it = CART.find(i => i.code === code);
  if (it) it.qty += qty; else CART.push({ code, qty });
  saveCart();
}

/* ---------- categories / tabs ---------- */
function cats() {
  const have = [...new Set(DATA.products.map(p => p.collection || ''))];
  const list = (DATA.categories || []).filter(c => have.includes(c.key));
  have.forEach(k => { if (!list.find(c => c.key === k)) list.push({ key: k, label: (k || 'Other').replace(/ Collection$/i, '') }); });
  return list;
}
function renderTabs() {
  const list = cats();
  $('#tabs').innerHTML = list.map(c =>
    `<button class="tab ${c.key === CAT ? 'on' : ''}" data-k="${esc(c.key)}">${esc(c.label)}</button>`).join('') +
    `<button class="tab ${CAT === '__all' ? 'on' : ''}" data-k="__all">All</button>`;
}
function selectCat(k) {
  CAT = k; $('#search').value = ''; Q = '';
  renderTabs(); renderGrid();
  const on = document.querySelector('.tab.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  window.scrollTo({ top: 0 });
}

/* ---------- colour dot + list/grid view ---------- */
function dotCss(f) {
  f = String(f || '').toLowerCase();
  if (f.includes('copper')) return '#b87333';
  if (f.includes('silver')) return '#b9bec5';
  if (f.includes('black')) return '#262626';
  if (f.includes('wood') && f.includes('brass')) return 'linear-gradient(135deg,#8a5a2b 50%,#c9a227 50%)';
  if (f.includes('brass')) return '#c9a227';
  if (f.includes('paint')) return 'conic-gradient(#d9534f,#f0ad4e,#5cb85c,#3b82c4,#8e5bb5,#d9534f)';
  return '#cdbfa5';
}
let VIEW = localStorage.getItem('artime_view') || (window.innerWidth < 620 ? 'list' : 'grid');
function applyView() {
  $('#grid').classList.toggle('list', VIEW === 'list');
  $('#viewBtn').innerHTML = VIEW === 'list'
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="3" y="4" width="18" height="4" rx="1.5"/><rect x="3" y="10" width="18" height="4" rx="1.5"/><rect x="3" y="16" width="18" height="4" rx="1.5"/></svg>';
  $('#viewBtn').title = VIEW === 'list' ? 'Show grid' : 'Show list';
}
$('#viewBtn').addEventListener('click', () => { VIEW = VIEW === 'list' ? 'grid' : 'list'; localStorage.setItem('artime_view', VIEW); applyView(); });
applyView();

/* ---------- product grid ---------- */
function renderGrid() {
  const items = DATA.products.filter(p => {
    if (CAT !== '__all' && (p.collection || '') !== CAT) return false;
    if (Q && ![p.code, p.title, p.finish, p.pattern, p.size].join(' ').toLowerCase().includes(Q)) return false;
    return true;
  });
  $('#count').textContent = items.length + ' piece' + (items.length !== 1 ? 's' : '');
  if (!items.length) { $('#grid').innerHTML = '<div class="state">No pieces found.</div>'; return; }
  $('#grid').innerHTML = items.map(p => `
    <article class="card" data-code="${esc(p.code)}">
      <div class="ph" data-act="zoom"><img src="${esc(mainImg(p))}" alt="${esc(p.code)}" loading="lazy" onerror="this.onerror=null;this.src=PLACEHOLDER"></div>
      <div class="info">
        <div class="code">${esc(p.code)}</div>
        <div class="metas">
          <div class="meta"><span>Colour</span><b>${esc(p.finish)}<i class="dot" style="background:${dotCss(p.finish)}"></i></b></div>
          <div class="meta"><span>Size</span><b>${esc(sizeTxt(p.size))}</b></div>
        </div>
        <div class="price">${money(p.price)}<small>+ GST</small></div>
      </div>
      <div class="buy">
        <div class="stepper"><button data-act="minus" aria-label="less">−</button><input type="number" inputmode="numeric" min="1" value="1" aria-label="quantity"><button data-act="plus" aria-label="more">+</button></div>
        <button class="btn add" data-act="add">Add to order</button>
      </div>
      <div class="incart" data-badge="${esc(p.code)}"></div>
    </article>`).join('');
  updateBadges();
}
function updateBadges() {
  document.querySelectorAll('[data-badge]').forEach(el => {
    const it = CART.find(i => i.code === el.dataset.badge);
    el.textContent = it ? `✓ ${it.qty} in your order` : '';
  });
}
$('#grid').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const card = b.closest('.card'); const code = card.dataset.code;
  const inp = card.querySelector('.stepper input');
  const act = b.dataset.act;
  if (act === 'plus') inp.value = Math.min(9999, (parseInt(inp.value, 10) || 1) + 1);
  else if (act === 'minus') inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) - 1);
  else if (act === 'add') {
    const q = Math.max(1, parseInt(inp.value, 10) || 1);
    addToCart(code, q); inp.value = 1; toast(`✓ ${q} × ${code} added`);
  } else if (act === 'zoom') openLb(code);
});
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) selectCat(b.dataset.k); });
$('#search').addEventListener('input', e => { Q = e.target.value.trim().toLowerCase(); if (Q && CAT !== '__all') { CAT = '__all'; renderTabs(); } renderGrid(); });

/* ---------- bottom bar ---------- */
function updateBar() {
  const t = totals();
  $('#bar').classList.toggle('show', t.pcs > 0);
  $('#barPcs').textContent = t.pcs + (t.pcs === 1 ? ' piece' : ' pieces');
  $('#barTotal').textContent = money(t.total) + ' + GST';
}

/* ---------- photo viewer ---------- */
function openLb(code) {
  const p = BY[code]; if (!p) return;
  lbImgs = [(p.images && p.images[0]) || PLACEHOLDER]; lbIdx = 0; lbShow();   // only photo 1 is used
  $('#lb').classList.add('open');
  document.querySelectorAll('.lb-n').forEach(b => b.style.display = lbImgs.length > 1 ? 'flex' : 'none');
  $('#lb').dataset.code = code;
}
function lbShow() { $('#lbImg').src = lbImgs[lbIdx]; $('#lbCap').textContent = `${$('#lb').dataset.code || ''}  (${lbIdx + 1}/${lbImgs.length})`; }
$('#lb').addEventListener('click', e => {
  const a = e.target.dataset.lb;
  if (a === 'prev') { lbIdx = (lbIdx - 1 + lbImgs.length) % lbImgs.length; lbShow(); }
  else if (a === 'next') { lbIdx = (lbIdx + 1) % lbImgs.length; lbShow(); }
  else if (a === 'close' || e.target.id === 'lb') $('#lb').classList.remove('open');
});

/* ---------- order sheet ---------- */
let sheetLock = false, downTarget = null;
// keep the sheet inside the VISIBLE area (above the on-screen keyboard)
function fitSheet() {
  const w = $('#sheet'), vv = window.visualViewport;
  if (!vv || !w.classList.contains('open')) { w.style.top = w.style.height = w.style.bottom = ''; return; }
  w.style.top = vv.offsetTop + 'px'; w.style.height = vv.height + 'px'; w.style.bottom = 'auto';
}
if (window.visualViewport) { visualViewport.addEventListener('resize', fitSheet); visualViewport.addEventListener('scroll', fitSheet); }
function openSheet() { $('#sheet').classList.add('open'); document.body.classList.add('noscroll'); fitSheet(); }
function closeSheet() { sheetLock = false; $('#sheet').classList.remove('open'); document.body.classList.remove('noscroll'); fitSheet(); }
function setSheet(html) {
  const old = $('#sheetBox .sheet-body'); const st = old ? old.scrollTop : 0;
  $('#sheetBox').innerHTML = html;
  const nb = $('#sheetBox .sheet-body'); if (nb) nb.scrollTop = st;
}
const head = (title, back) => `<div class="sheet-head">${back ? `<button class="x" data-act="${back}">‹</button>` : ''}<h2>${title}</h2><button class="x" data-act="close">&times;</button></div>`;

function stepReview() {
  sheetLock = false;
  const L = lines(), t = totals();
  if (!L.length) { setSheet(head('Your order') + '<div class="sheet-body"><p class="state">No pieces added yet.</p></div>'); return; }
  setSheet(head('Check your order') + `<div class="sheet-body"><p class="hint">Please check the pieces and quantities.</p>` +
    L.map(l => `
    <div class="line" data-code="${esc(l.p.code)}">
      <img src="${esc(mainImg(l.p))}" alt="" onerror="this.onerror=null;this.src=PLACEHOLDER">
      <div class="line-main">
        <b>${esc(l.p.code)}</b>
        <div class="line-meta">${esc(sizeTxt(l.p.size))} · ${esc(l.p.finish)}</div>
        <div class="line-meta">${money(l.p.price)} each</div>
        <div class="stepper sm"><button data-act="lminus">−</button><input type="number" inputmode="numeric" min="1" value="${l.qty}" data-act="lset"><button data-act="lplus">+</button></div>
      </div>
      <div class="line-side"><b>${money(l.p.price * l.qty)}</b><button class="rm" data-act="lrm" title="Remove">Remove</button></div>
    </div>`).join('') +
    `</div><div class="sheet-foot"><div class="tot"><span>${t.pcs} pcs</span><b>${money(t.total)}</b><small>+ GST</small></div>
     <button class="btn primary" data-act="to-details">Confirm order →</button></div>`);
}
function stepDetails(err) {
  sheetLock = true;
  const c = JSON.parse(localStorage.getItem(LS_CUST) || '{}'); const e = err || {};
  setSheet(head('Your details', 'to-review') + `<div class="sheet-body">
    <p class="hint">Tell us who is placing this order.</p>
    <label class="f">Your name<input id="fName" autocomplete="name" value="${esc(c.name || '')}" placeholder="Full name">${e.name ? `<em>${esc(e.name)}</em>` : ''}</label>
    <label class="f">Contact number<input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(c.phone || '')}" placeholder="10-digit mobile / WhatsApp number">${e.phone ? `<em>${esc(e.phone)}</em>` : ''}</label>
    <label class="f">Note <small>(optional)</small><textarea id="fNote" rows="2" placeholder="City, delivery note, etc."></textarea></label>
    </div><div class="sheet-foot"><div class="tot"><span>${totals().pcs} pcs</span><b>${money(totals().total)}</b><small>+ GST</small></div>
    <button class="btn primary" data-act="submit">Send order</button></div>`);
}
function stepBusy(msg) { sheetLock = true; setSheet(`<div class="busy"><div class="spin"></div><p>${esc(msg)}</p></div>`); }
function stepDone(o) {
  sheetLock = false;
  setSheet(`<div class="done"><div class="tick">✓</div><h2>Order sent!</h2>
    <p>Thank you, <b>${esc(o.name)}</b>.<br>Your order <b>${esc(o.no)}</b> has been sent to ARTIME. We will contact you on <b>${esc(o.phone)}</b>.</p>
    <button class="btn" data-act="dl">Download order PDF</button>
    <button class="btn primary" data-act="close">Done</button></div>`);
}
function stepFail(msg) {
  sheetLock = false;
  const canShare = !!(navigator.canShare && LAST && LAST.file && navigator.canShare({ files: [LAST.file] }));
  setSheet(`<div class="done"><div class="tick bad">!</div><h2>Could not send</h2>
    <p>${esc(msg)}<br>Your order is safe. Try again, or send the PDF yourself.</p>
    <button class="btn primary" data-act="retry">Try again</button>
    <button class="btn" data-act="dl">Download order PDF</button>
    <button class="btn" data-act="wa">${canShare ? 'Share PDF (WhatsApp etc.)' : 'Send on WhatsApp'}</button>
    <button class="btn ghost" data-act="to-details">‹ Back</button></div>`);
}

$('#placeBtn').addEventListener('click', () => { openSheet(); stepReview(); });
$('#sheet').addEventListener('pointerdown', e => { downTarget = e.target; });
$('#sheet').addEventListener('click', e => {
  if (e.target.id === 'sheet') { if (!sheetLock && downTarget && downTarget.id === 'sheet') closeSheet(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act; const line = b.closest('.line'); const code = line && line.dataset.code;
  const it = code && CART.find(i => i.code === code);
  if (act === 'close') closeSheet();
  else if (act === 'lplus' && it) { it.qty = Math.min(9999, it.qty + 1); saveCart(); stepReview(); }
  else if (act === 'lminus' && it) { it.qty = Math.max(1, it.qty - 1); saveCart(); stepReview(); }
  else if (act === 'lrm' && it) { CART = CART.filter(i => i.code !== code); saveCart(); CART.length ? stepReview() : closeSheet(); }
  else if (act === 'to-details') stepDetails();
  else if (act === 'to-review') stepReview();
  else if (act === 'submit') submitOrder();
  else if (act === 'retry') resend();
  else if (act === 'dl') downloadPdf();
  else if (act === 'wa') shareOrWhatsApp();
});
$('#sheet').addEventListener('input', e => {
  if (e.target.id === 'fName' || e.target.id === 'fPhone') {
    const c = JSON.parse(localStorage.getItem(LS_CUST) || '{}');
    if (e.target.id === 'fName') c.name = e.target.value; else c.phone = e.target.value;
    localStorage.setItem(LS_CUST, JSON.stringify(c));
  }
});
$('#sheet').addEventListener('focusin', e => {
  if (e.target.matches('input,textarea')) setTimeout(() => { try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 350);
});
$('#sheet').addEventListener('change', e => {
  if (e.target.dataset.act !== 'lset') return;
  const code = e.target.closest('.line').dataset.code; const it = CART.find(i => i.code === code);
  if (it) { it.qty = Math.max(1, parseInt(e.target.value, 10) || 1); saveCart(); stepReview(); }
});

/* ---------- validation + submit ---------- */
function cleanPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
function orderNo() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return 'AR' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + String(Math.floor(1000 + Math.random() * 9000));
}
async function submitOrder() {
  const name = ($('#fName').value || '').trim().replace(/\s+/g, ' ');
  const phone = cleanPhone($('#fPhone').value);
  const note = ($('#fNote').value || '').trim().slice(0, 200);
  const err = {};
  if (name.length < 2) err.name = 'Please enter your name.';
  if (!/^[6-9]\d{9}$/.test(phone)) err.phone = 'Enter a valid 10-digit mobile number.';
  if (err.name || err.phone) { stepDetails(err); $('#fNote').value = note; return; }
  localStorage.setItem(LS_CUST, JSON.stringify({ name, phone }));

  const L = lines(); if (!L.length) { closeSheet(); return; }
  const t = totals();
  const order = { no: orderNo(), date: new Date(), name, phone, note, lines: L, pieces: t.pcs, total: t.total };
  stepBusy('Preparing your order PDF…');
  let pdf;
  try { pdf = await buildPdf(order); }
  catch (e) { console.error(e); LAST = { order }; stepFail('The PDF could not be created (check your internet once).'); return; }
  LAST = { order, pdf, file: new File([pdf.blob], pdf.name, { type: 'application/pdf' }) };
  await resend();
}
async function resend() {
  if (!LAST || !LAST.pdf) { stepDetails(); return; }
  stepBusy('Sending your order…');
  try {
    await sendOrder(LAST.order, LAST.pdf);
    CART = []; saveCart(); stepDone(LAST.order);
  } catch (e) {
    console.error(e);
    stepFail(navigator.onLine ? 'The order could not be delivered right now.' : 'You seem to be offline.');
  }
}
async function sendOrder(o, pdf) {
  const fd = new FormData();
  fd.append('name', o.name); fd.append('phone', o.phone); fd.append('note', o.note || '');
  fd.append('orderNo', o.no); fd.append('total', String(o.total)); fd.append('pieces', String(o.pieces));
  fd.append('summary', o.lines.map((l, i) =>
    `${i + 1}. ${l.p.code} | ${sizeTxt(l.p.size)} | ${l.p.finish} | ${l.qty} x ${money(l.p.price)} = ${money(l.p.price * l.qty)}`).join('\n'));
  fd.append('pdf', pdf.blob, pdf.name);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(API_BASE + '/order', { method: 'POST', body: fd, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Send failed');
  } finally { clearTimeout(timer); }
}
function downloadPdf() {
  if (!LAST || !LAST.pdf) return;
  const a = document.createElement('a'); a.href = URL.createObjectURL(LAST.pdf.blob); a.download = LAST.pdf.name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
async function shareOrWhatsApp() {
  if (!LAST) return; const o = LAST.order;
  const text = `ARTIME order ${o.no}\n${o.name} (${o.phone})\n${o.pieces} pcs · ${money(o.total)} + GST`;
  if (LAST.file && navigator.canShare && navigator.canShare({ files: [LAST.file] })) {
    try { await navigator.share({ files: [LAST.file], text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  downloadPdf();
  const wa = (DATA.settings && DATA.settings.whatsapp) || '917229922002';
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text + '\n(PDF attached)')}`, '_blank');
}

/* ---------- PDF ---------- */
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve();
  if (loadJsPdf._p) return loadJsPdf._p;
  loadJsPdf._p = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = JSPDF_URL; s.crossOrigin = 'anonymous';
    s.onload = res; s.onerror = () => { loadJsPdf._p = null; rej(new Error('jsPDF failed to load')); };
    document.head.appendChild(s);
  });
  return loadJsPdf._p;
}
function imgData(url, max) {
  return new Promise(res => {
    if (!url) return res(null);
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        res({ d: c.toDataURL('image/jpeg', 0.78), w: c.width, h: c.height });
      } catch (e) { res(null); }
    };
    im.onerror = () => res(null); im.src = url;
  });
}
const pdfSafe = s => String(s == null ? '' : s).replace(/[—–]/g, '-').replace(/×/g, 'x').replace(/[^\x20-\xFF]/g, '?');
const rs = n => 'Rs. ' + Number(n).toLocaleString('en-IN');

async function buildPdf(o) {
  await loadJsPdf();
  const photos = await Promise.all(o.lines.map(l => imgData(l.p.images && l.p.images[0], 460)));
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 12, BOTTOM = 272, RH = 38, PH = 32;
  const X = { photo: M, item: M + 38, qty: 116, rate: 152, amt: W - M };
  const dateStr = o.date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // value followed by a small "+ GST" tag, right-aligned at x
  function amount(x, y, val, big) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 108, 94);
    const gst = '+ GST', gw = doc.getTextWidth(gst);
    doc.text(gst, x, y, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 10.5 : 9.5); doc.setTextColor(30, 24, 20);
    doc.text(val, x - gw - 1.5, y, { align: 'right' });
  }
  function band() {
    doc.setFillColor(31, 26, 23); doc.rect(0, 0, W, 13, 'F');
    doc.setTextColor(214, 170, 90); doc.setFont('times', 'bold'); doc.setFontSize(15); doc.text('ARTIME', M, 9);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('ORDER', W - M, 8.8, { align: 'right' });
  }
  function tableHead(y) {
    doc.setFillColor(240, 232, 218); doc.rect(M, y, W - 2 * M, 8, 'F');
    doc.setTextColor(60, 50, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('PHOTO', X.photo + 2, y + 5.4); doc.text('DETAILS', X.item, y + 5.4);
    doc.text('QTY', X.qty, y + 5.4, { align: 'right' }); doc.text('RATE', X.rate, y + 5.4, { align: 'right' });
    doc.text('AMOUNT', X.amt - 1, y + 5.4, { align: 'right' });
    return y + 8;
  }

  band();
  doc.setTextColor(40, 32, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('CUSTOMER', M, 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5); doc.text(pdfSafe(o.name), M, 29);
  doc.setFontSize(10); doc.text('Mobile: ' + o.phone, M, 34.5);
  let y = 39.5;
  if (o.note) {
    doc.setFontSize(8.5); doc.setTextColor(110, 98, 86);
    const nl = doc.splitTextToSize('Note: ' + pdfSafe(o.note), 105).slice(0, 3); doc.text(nl, M, y); y += nl.length * 4;
  }
  doc.setTextColor(40, 32, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('ORDER NO', W - M, 23, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5); doc.text(o.no, W - M, 29, { align: 'right' });
  doc.setFontSize(9); doc.setTextColor(110, 98, 86); doc.text(dateStr, W - M, 34.5, { align: 'right' });
  y = Math.max(y, 40) + 4;
  y = tableHead(y);

  o.lines.forEach((l, i) => {
    if (y + RH > BOTTOM) { doc.addPage(); band(); y = tableHead(19); }
    const p = l.p;
    doc.setDrawColor(226, 216, 198); doc.setLineWidth(0.2); doc.line(M, y + RH, W - M, y + RH);
    // photo (bigger)
    const bx = X.photo + 1, by = y + 3;
    doc.setFillColor(250, 247, 241); doc.rect(bx, by, PH, PH, 'F');
    const ph = photos[i];
    if (ph) {
      const k = Math.min(PH / ph.w, PH / ph.h), w = ph.w * k, h = ph.h * k;
      doc.addImage(ph.d, 'JPEG', bx + (PH - w) / 2, by + (PH - h) / 2, w, h);
    }
    doc.setDrawColor(220, 208, 186); doc.rect(bx, by, PH, PH);
    // details: code, size, colour under size
    doc.setTextColor(30, 24, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(pdfSafe(p.code), X.item, y + 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 50, 40);
    const sz = doc.splitTextToSize('Size: ' + pdfSafe(sizeTxt(p.size)), 58).slice(0, 2);
    doc.text(sz, X.item, y + 17);
    doc.text('Colour: ' + pdfSafe(p.finish), X.item, y + 17 + sz.length * 5 + 1);
    // qty / rate / amount (+ GST after each amount)
    doc.setTextColor(30, 24, 20); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(String(l.qty), X.qty, y + 10, { align: 'right' });
    amount(X.rate, y + 10, rs(p.price), false);
    amount(X.amt - 1, y + 10, rs(p.price * l.qty), true);
    y += RH;
  });

  if (y + 24 > BOTTOM + 8) { doc.addPage(); band(); y = 24; }
  y += 6;
  doc.setFillColor(31, 26, 23); doc.roundedRect(W - M - 92, y, 92, 16, 1.5, 1.5, 'F');
  doc.setTextColor(225, 214, 192); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  doc.text(o.pieces + (o.pieces === 1 ? ' piece' : ' pieces'), W - M - 88, y + 9.7);
  doc.setFontSize(8); doc.setTextColor(200, 188, 166);
  const g = '+ GST', gw = doc.getTextWidth(g); doc.text(g, W - M - 4, y + 9.7, { align: 'right' });
  doc.setTextColor(214, 170, 90); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(rs(o.total), W - M - 4 - gw - 2, y + 10.2, { align: 'right' });

  const st = DATA.settings || {}; const n = doc.getNumberOfPages();
  for (let pg = 1; pg <= n; pg++) {
    doc.setPage(pg); doc.setFontSize(8); doc.setTextColor(130, 118, 104); doc.setFont('helvetica', 'normal');
    doc.text(pdfSafe('The Times and Craft Exports, Jodhpur  |  ' + (st.phone || '') + '  |  ' + (st.email || '')), M, 287);
    doc.text('Page ' + pg + ' / ' + n, W - M, 287, { align: 'right' });
  }
  return { blob: doc.output('blob'), name: `ARTIME-Order-${o.no}.pdf` };
}

/* ---------- install (PWA) ---------- */
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (!isStandalone()) $('#installBtn').hidden = false; });
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('App installed'); });
$('#installBtn').addEventListener('click', async () => {
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true; }
  else if (isIOS) { openSheet(); setSheet(head('Install ARTIME') + `<div class="sheet-body"><p class="hint">On iPhone / iPad:</p><p>1. Tap the <b>Share</b> button in Safari.<br>2. Choose <b>Add to Home Screen</b>.<br>3. Tap <b>Add</b>.</p></div><div class="sheet-foot"><button class="btn primary" data-act="close">OK</button></div>`); }
});
if (isIOS && !isStandalone()) $('#installBtn').hidden = false;

/* ---------- boot ---------- */
async function fetchCatalog() {
  try {
    const r = await fetch(API_BASE + '/catalog', { cache: 'no-store' });
    const j = await r.json();
    if (j && j.ok) { if (!j.empty) localStorage.setItem(LS_DATA, JSON.stringify(j)); return j; }
  } catch (e) { /* offline - fall through */ }
  try { return JSON.parse(localStorage.getItem(LS_DATA) || 'null'); } catch (e) { return null; }
}
(async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  loadCart();
  DATA = await fetchCatalog();
  if (!DATA || DATA.empty || !DATA.products || !DATA.products.length) {
    $('#grid').innerHTML = '<div class="state">Catalog is not available right now.<br>Please check your internet and reopen.</div>'; return;
  }
  DATA.products.forEach(p => { BY[p.code] = p; });
  CART = CART.filter(i => BY[i.code]);
  const want = (new URLSearchParams(location.search).get('category') || '').toLowerCase();
  const list = cats();
  const hit = want && list.find(c => c.key.toLowerCase() === want || c.label.toLowerCase() === want);
  CAT = hit ? hit.key : (want === 'all' ? '__all' : (list[0] ? list[0].key : '__all'));
  renderTabs(); renderGrid(); updateBar();
  if ('requestIdleCallback' in window) requestIdleCallback(() => loadJsPdf().catch(() => {})); else setTimeout(() => loadJsPdf().catch(() => {}), 3000);
})();
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#lb').classList.remove('open'); if (!sheetLock) closeSheet(); } });
})();
