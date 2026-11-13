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
        <div class="meta"><span>Size</span> ${esc(sizeTxt(p.size))}</div>
        <div class="meta"><span>Colour</span> ${esc(p.finish)}</div>
        <div class="price">${money(p.price)} <small>+ GST</small></div>
        <div class="buy">
          <div class="stepper"><button data-act="minus" aria-label="less">−</button><input type="number" inputmode="numeric" min="1" value="1" aria-label="quantity"><button data-act="plus" aria-label="more">+</button></div>
          <button class="btn add" data-act="add">Add</button>
        </div>
        <div class="incart" data-badge="${esc(p.code)}"></div>
      </div>
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
  lbImgs = (p.images && p.images.length) ? p.images : [PLACEHOLDER]; lbIdx = 0; lbShow();
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
function openSheet() { $('#sheet').classList.add('open'); document.body.classList.add('noscroll'); }
function closeSheet() { $('#sheet').classList.remove('open'); document.body.classList.remove('noscroll'); }
function setSheet(html) {
  const old = $('#sheetBox .sheet-body'); const st = old ? old.scrollTop : 0;
  $('#sheetBox').innerHTML = html;
  const nb = $('#sheetBox .sheet-body'); if (nb) nb.scrollTop = st;
}
const head = (title, back) => `<div class="sheet-head">${back ? `<button class="x" data-act="${back}">‹</button>` : ''}<h2>${title}</h2><button class="x" data-act="close">&times;</button></div>`;

function stepReview() {
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
  const c = JSON.parse(localStorage.getItem(LS_CUST) || '{}'); const e = err || {};
  setSheet(head('Your details', 'to-review') + `<div class="sheet-body">
    <p class="hint">Tell us who is placing this order.</p>
    <label class="f">Your name<input id="fName" autocomplete="name" value="${esc(c.name || '')}" placeholder="Full name">${e.name ? `<em>${esc(e.name)}</em>` : ''}</label>
    <label class="f">Contact number<input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(c.phone || '')}" placeholder="10-digit mobile / WhatsApp number">${e.phone ? `<em>${esc(e.phone)}</em>` : ''}</label>
    <label class="f">Note <small>(optional)</small><textarea id="fNote" rows="2" placeholder="City, delivery note, etc."></textarea></label>
    </div><div class="sheet-foot"><div class="tot"><span>${totals().pcs} pcs</span><b>${money(totals().total)}</b><small>+ GST</small></div>
    <button class="btn primary" data-act="submit">Send order</button></div>`);
}
function stepBusy(msg) { setSheet(`<div class="busy"><div class="spin"></div><p>${esc(msg)}</p></div>`); }
function stepDone(o) {
  setSheet(`<div class="done"><div class="tick">✓</div><h2>Order sent!</h2>
    <p>Thank you, <b>${esc(o.name)}</b>.<br>Your order <b>${esc(o.no)}</b> has been sent to ARTIME. We will contact you on <b>${esc(o.phone)}</b>.</p>
    <button class="btn" data-act="dl">Download order PDF</button>
    <button class="btn primary" data-act="close">Done</button></div>`);
}
function stepFail(msg) {
  const canShare = !!(navigator.canShare && LAST && LAST.file && navigator.canShare({ files: [LAST.file] }));
  setSheet(`<div class="done"><div class="tick bad">!</div><h2>Could not send</h2>
    <p>${esc(msg)}<br>Your order is safe. Try again, or send the PDF yourself.</p>
    <button class="btn primary" data-act="retry">Try again</button>
    <button class="btn" data-act="dl">Download order PDF</button>
    <button class="btn" data-act="wa">${canShare ? 'Share PDF (WhatsApp etc.)' : 'Send on WhatsApp'}</button>
    <button class="btn ghost" data-act="to-details">‹ Back</button></div>`);
}

$('#placeBtn').addEventListener('click', () => { openSheet(); stepReview(); });
$('#sheet').addEventListener('click', e => {
  if (e.target.id === 'sheet') { closeSheet(); return; }
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
  const photos = await Promise.all(o.lines.map(l => imgData(l.p.images && l.p.images[0], 260)));
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 12, BOTTOM = 270, RH = 28;
  const X = { photo: M, item: M + 28, size: M + 84, color: M + 114, qty: M + 146, rate: M + 166, amt: W - M };
  const dateStr = o.date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  function band() {
    doc.setFillColor(31, 26, 23); doc.rect(0, 0, W, 24, 'F');
    doc.setTextColor(214, 170, 90); doc.setFont('times', 'bold'); doc.setFontSize(23); doc.text('ARTIME', M, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(225, 214, 192); doc.text('Handcrafted Clocks', M, 20.5);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('ORDER', W - M, 15, { align: 'right' });
  }
  function tableHead(y) {
    doc.setFillColor(240, 232, 218); doc.rect(M, y, W - 2 * M, 8, 'F');
    doc.setTextColor(60, 50, 40); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('PHOTO', X.photo + 2, y + 5.4); doc.text('CODE', X.item, y + 5.4); doc.text('SIZE', X.size, y + 5.4);
    doc.text('COLOUR', X.color, y + 5.4); doc.text('QTY', X.qty + 8, y + 5.4, { align: 'right' });
    doc.text('RATE', X.rate + 9, y + 5.4, { align: 'right' }); doc.text('AMOUNT', X.amt - 1, y + 5.4, { align: 'right' });
    return y + 8;
  }

  band();
  // order + customer block
  doc.setTextColor(40, 32, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('CUSTOMER', M, 33);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(pdfSafe(o.name), M, 39);
  doc.setFontSize(10); doc.text('Mobile: ' + o.phone, M, 44.5);
  let y = 50;
  if (o.note) {
    doc.setFontSize(8.5); doc.setTextColor(110, 98, 86);
    const nl = doc.splitTextToSize('Note: ' + pdfSafe(o.note), 100).slice(0, 3); doc.text(nl, M, y); y += nl.length * 4;
  }
  doc.setTextColor(40, 32, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('ORDER NO', W - M, 33, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(o.no, W - M, 39, { align: 'right' });
  doc.setFontSize(9); doc.setTextColor(110, 98, 86); doc.text(dateStr, W - M, 44.5, { align: 'right' });
  y = Math.max(y, 52) + 3;
  y = tableHead(y);

  o.lines.forEach((l, i) => {
    if (y + RH > BOTTOM) { doc.addPage(); band(); y = tableHead(30); }
    const p = l.p;
    doc.setDrawColor(226, 216, 198); doc.setLineWidth(0.2); doc.line(M, y + RH, W - M, y + RH);
    // photo
    const bx = X.photo + 1, by = y + 2, bs = RH - 4;
    doc.setFillColor(250, 247, 241); doc.rect(bx, by, bs, bs, 'F');
    const ph = photos[i];
    if (ph) {
      const k = Math.min(bs / ph.w, bs / ph.h), w = ph.w * k, h = ph.h * k;
      doc.addImage(ph.d, 'JPEG', bx + (bs - w) / 2, by + (bs - h) / 2, w, h);
    }
    doc.setDrawColor(220, 208, 186); doc.rect(bx, by, bs, bs);
    doc.setTextColor(30, 24, 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(pdfSafe(p.code), X.item, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 98, 86);
    doc.text(doc.splitTextToSize(pdfSafe(p.title), 52).slice(0, 3), X.item, y + 13);
    doc.setTextColor(30, 24, 20); doc.setFontSize(9);
    doc.text(doc.splitTextToSize(pdfSafe(sizeTxt(p.size)), 28).slice(0, 3), X.size, y + 8);
    doc.text(doc.splitTextToSize(pdfSafe(p.finish), 30).slice(0, 3), X.color, y + 8);
    doc.setFont('helvetica', 'bold'); doc.text(String(l.qty), X.qty + 8, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.text(rs(p.price), X.rate + 9, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.text(rs(p.price * l.qty), X.amt - 1, y + 8, { align: 'right' });
    y += RH;
  });

  if (y + 26 > BOTTOM + 6) { doc.addPage(); band(); y = 32; }
  y += 6;
  doc.setFillColor(31, 26, 23); doc.roundedRect(W - M - 80, y, 80, 17, 1.5, 1.5, 'F');
  doc.setTextColor(225, 214, 192); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(o.pieces + ' pieces', W - M - 76, y + 6.5);
  doc.setTextColor(214, 170, 90); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(rs(o.total), W - M - 4, y + 11.5, { align: 'right' });
  doc.setFontSize(7.5); doc.setTextColor(225, 214, 192); doc.setFont('helvetica', 'normal'); doc.text('Exclusive of GST', W - M - 4, y + 15.3, { align: 'right' });

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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#lb').classList.remove('open'); closeSheet(); } });
})();
