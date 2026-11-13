/* Shared settings + helpers (customer app and admin panel) */
const API_BASE = "https://artime-catalog.thetimesandcraftexport.workers.dev";   // your Cloudflare Worker URL
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  return res.json();
}
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#efe7d8"/>' +
  '<circle cx="50" cy="50" r="24" fill="none" stroke="#b8893b" stroke-width="3"/><path d="M50 36v15l10 6" fill="none" stroke="#b8893b" stroke-width="3" stroke-linecap="round"/></svg>');
