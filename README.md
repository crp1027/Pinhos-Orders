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
| Receipt printer key | Cloudflare secret `PRINTER_KEY` (never in this repo) |

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
3. **Receipt printer (Star TSP143IV, CloudPRNT):** add a second **Runtime** secret named `PRINTER_KEY` (a long random code).
   - In the site, go to **Settings → Receipt printer** to copy the exact Server URL: `https://<your site>/cloudprnt/<PRINTER_KEY>`.
   - Enter that URL on the printer with CloudPRNT on and a 5-second poll. **Print a test receipt** checks that it works.
4. **Open the site:** it lives at the `…workers.dev` address shown on the Worker's page. Enter the PIN, and the device stays unlocked for 12 hours or until **Lock**.

After this, every change pushed to GitHub redeploys the site automatically.

## For developers
- **Source:** the app source is in `src/`. `npm run build` combines it into `worker/app.html`; commit that file too.
- **Run locally:** `npm run dev`. It uses `.dev.vars` (`STAFF_PIN=1234`) and a local database.
- **Printer route:** `/cloudprnt/<PRINTER_KEY>` follows Star CloudPRNT over HTTP. The printer POSTs a poll, GETs the job (an `image/png` 576 dots wide with `X-Star-Cut: partial`), then confirms with DELETE. It needs no PIN, but a wrong key returns 404. Waiting jobs expire after 15 minutes.
- **Swapping storage:** `src/cloud.js` gives the app the same database interface it had inside Claude. Storage can change there without touching the screens.
