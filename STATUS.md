# Project7 - Winyle

## Pending

- **Agent task (Jacek, 2026-09-27): continuous four-at-a-time scanning.** Today "Cztery na raz (kwadrat)" is one-shot:
  native camera → split → preview → confirm → review list, and you go back to the menu for the next four. Jacek wants
  to lay four sleeves in a square, shoot, lay the next four, shoot, and keep going; identification runs in the
  background and everything is reviewed afterwards (this stays a private app for Jacek and his dad). Build it in
  `index.html`:
  1. In `openScanner` (batch mode) add a third segment to `#scanseg`: **Kod kreskowy · Okładka · Czwórka**. In
     `quad` mode show a square guide like `.cguide` but with a 2×2 grid drawn inside (two amber lines) and the digits
     1–4 in the corners (top-left, top-right, bottom-left, bottom-right); show the shutter; message
     "Ułóż cztery okładki w kwadrat i naciśnij spust".
  2. Shutter in `quad` mode: `cropFromVideo(v, guideRect)` but at full guide resolution (add a `max` parameter,
     use 1200 so each quadrant is ~600 px), then `quadrants(dataUrl)` → call `opt.onQuad(parts)`; flash + blip once;
     stay in the camera. Nothing is looked up while you shoot.
  3. In `openCapture`: `onQuad: parts => parts.forEach(p => enqueue({kind:'photo', photo:p, quad:true}))`, so the four
     land in the queue in reading order as 'pending' and the existing pool (3) resolves them via `identifyPhoto`.
     Bump the counter by 4 and show the four chips in `#bstrip`.
  4. The menu button "Cztery na raz (kwadrat)" starts the batch scanner directly in `quad` mode (`startBatch('quad')`);
     keep the old file-input path as a fallback when `BarcodeDetector`/camera is unavailable (the current `doQuad`).
  5. Review (`showReview`) unchanged: pending → ok / ambiguous / none, placeholders keep their slot, "Wybierz okładkę"
     and "Skanuj ponownie" work per item. A quadrant that is empty background (all four corners near the background
     colour after `trimSquare`) is dropped silently, so a last row of two sleeves does not create two junk items.
  6. Pool: raise to 4 while quad items are queued, or keep 3 — measure on the phone; the Claude proxy is the slow
     step (one call per sleeve).
  7. README "Four at a time" paragraph → describe the continuous flow; STATUS Done entry; bump the `sw.js` cache
     version so phones pick up the new build; push to `main` (GitHub Pages deploys it).
  Test: on the phone, https://jarze07.github.io/0007-winyle/ → skrzynka → Dodaj płytę → Cztery na raz; shoot three
  squares in a row, then Gotowe; all 12 appear in order and resolve in the background
- Rebuild `winyle.apk`: TWA still opens the dead `/winyle/` URL; `android/` project must be recreated
- Put the Cloudflare Worker source into the repo and redeploy via wrangler
- Add auth to `POST /api/db` (anyone with the Worker URL can write)
- Add the Discogs barcode route to the Worker
- Add spec-kit scaffold

## Specification

No Google Cloud project: `jr07-0007-winyle` was deleted on 2026-09-27, it was never used (the app talks to the
Cloudflare Worker, MusicBrainz, iTunes and Cover Art Archive only). Hosting: GitHub Pages; the box (`jr07 site add`)
is the alternative if Pages ever becomes a limit.

Winyle - vinyl collection catalogue PWA + TWA APK.

Full description and setup: `README.md` in this repo.

## Done

- Done 2026-09-27: checked after the Google Cloud clean-up: site 200, Worker `/api/db` and `/api/claude` answer,
  `/api/discogs` still 404 (not added), collection synced 2026-09-13 (5 albums). Nothing depended on Google Cloud
