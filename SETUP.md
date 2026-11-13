# ARTIME catalog – setup (about 15 minutes)

## What you have
| File | Purpose |
|---|---|
| `index.html`, `customer.js`, `styles.css`, `app.js` | Customer app (no password) |
| `admin.html`, `admin.js` | Admin panel (password) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Makes the customer app installable (PWA) |
| `worker/worker.js` | Cloudflare Worker: stores catalog, sends order PDF to Telegram |

Customer link: `https://YOUR-SITE/`  |  Admin link: `https://YOUR-SITE/admin.html`

## 1. Telegram bot
1. In Telegram open **@BotFather** → `/newbot` → copy the **bot token**.
2. Send any message to your new bot (or add it to a group where orders should arrive).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser → find `"chat":{"id": ...}` → that is your **chat id** (groups start with `-`).
   You can put several ids separated by commas to send orders to more than one person.

## 2. Cloudflare Worker
1. Cloudflare dashboard → Workers → open your existing `artime-catalog` worker → **Edit code** → replace everything with `worker/worker.js` → Deploy.
2. Workers & Pages → **KV** → create a namespace (e.g. `artime-catalog-data`).
3. Worker → Settings → **Bindings** → add **KV namespace**, variable name exactly `CATALOG`.
4. Worker → Settings → **Variables and Secrets** → add 3 secrets:
   - `ADMIN_PASSWORD` – your new admin password
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. If your worker URL is not `https://artime-catalog.thetimesandcraftexport.workers.dev`, change `API_BASE` at the top of `app.js`.

## 3. Upload the site
Put all files (except the `worker` folder) in your GitHub Pages repo, **next to your existing `images/` folder** (`images/products/...` paths are unchanged).

## 4. First-time admin steps
1. Open `/admin.html` → log in.
2. **Import JSON** → choose your current catalog JSON file → check the categories → **Save changes**.
3. Press **Test Telegram** – a message should arrive.
4. Open the customer link, add a piece, place a test order.

## Notes
- **Customer price:** the customer app shows ONE price. It is set in Admin → “Price shown to customers” (default: the 5th price column, the highest). Other prices are never sent to customers.
- **Old passwords:** the old data file held access codes and the admin password in plain text. They are removed on import. Use a fresh admin password (the old one was shared in a chat).
- **Install as app:** Android/Chrome shows an “Install app” button; on iPhone use Share → Add to Home Screen. The normal link keeps working in any browser.
- **PDF:** uses the jsPDF library from cdnjs (cached after first use). Rupee symbol is written as “Rs.”; non-English letters in a name may appear as “?” in the PDF, but Telegram shows the full name in the message.
- **Updating the app:** when you change app files, bump `VER` in `sw.js` so phones refresh.
