# Pinho's Cake Orders

The bakery's internal cake-order site. It runs on Cloudflare and is locked with one staff PIN.

## What lives where
| Piece | Where |
|---|---|
| Code (this folder) | GitHub: `crp1027/Pinhos-Orders` |
| Website and server | Cloudflare Worker `pinhos-orders` (`worker/index.js`) |
| Orders and settings | Cloudflare D1 database `pinhos-orders` |
| Cake pictures | Cloudflare R2 bucket `pinhos-pictures` |
| Staff PIN | Cloudflare secret `STAFF_PIN` (never in this repo) |

## One-time setup in Cloudflare
1. **Workers & Pages → Create → Import a repository →** pick `Pinhos-Orders`.
   - Project name: `pinhos-orders`
   - Deploy command: `npx wrangler deploy` (the default)
   - Click **Deploy**. The first deploy creates the database and picture storage on its own.
2. **Set the PIN:** open the `pinhos-orders` Worker → **Settings → Variables and Secrets → Add**.
   - Type: **Secret**
   - Name: `STAFF_PIN`
   - Value: your PIN
   - Click **Deploy**.
3. **Open the site:** it lives at the `…workers.dev` address shown on the Worker's page. Enter the PIN, and the device stays unlocked for 12 hours or until **Lock**.

After this, every change pushed to GitHub redeploys the site automatically.

## For developers
- **Source:** the app source is in `src/`. `npm run build` combines it into `worker/app.html`; commit that file too.
- **Run locally:** `npm run dev`. It uses `.dev.vars` (`STAFF_PIN=1234`) and a local database.
- **Swapping storage:** `src/cloud.js` gives the app the same database interface it had inside Claude. Storage can change there without touching the screens.
