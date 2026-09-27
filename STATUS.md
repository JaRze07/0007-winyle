# Project7 - Winyle

## Pending

- **Check continuous four-at-a-time on the phone** (the only part that can't be checked here):
  <https://jarze07.github.io/0007-winyle/> → skrzynka → Dodaj płytę → Cztery na raz; shoot three squares in a
  row, then Gotowe — all 12 should appear in packing order and resolve in the background. Also worth timing:
  the background pool is still 3, and a square lands four Claude-proxy lookups at once; raise it to 4 in
  `openCapture` only if the queue, not the proxy, turns out to be the thing waiting.
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

Bulk packing is one camera overlay with three segments — **Kod kreskowy / Okładka / Czwórka** — all feeding one
review queue, so nothing interrupts the packing rhythm. `Czwórka` shows a square guide with a 2x2 grid and the
corners numbered 1-4: lay four sleeves out, press the shutter, lay the next four, press again. Each shot is cut
out of the viewfinder at full guide resolution, split top-left -> top-right -> bottom-left -> bottom-right, and
the four sleeves are queued and identified in the background while you carry on. A quarter that is nothing but
the surface the records lie on is dropped, so a last square holding two records creates two items, not four.
Everything is reviewed at the end; unidentified items can still be added as placeholders that hold their slot.
Phones without `BarcodeDetector`/camera fall back to the previous one-shot file-input split.

Full description and setup: `README.md` in this repo.

## Done

- Done 2026-09-27: **continuous four-at-a-time scanning.** `openScanner` gained a third segment (`quad`) and a
  `startMode`, so "Cztery na raz" is no longer one-shot: the camera stays open and you shoot square after square.
  New: the 2x2 guide overlay with numbered corners (`.cguide.quad` is wider than the single-sleeve guide - easier
  to lay four records into and it hands the crop more sensor pixels), a `max` argument on `cropFromVideo` (1200 for
  a square, ~450-600 px per sleeve on a phone; it never upscales), `surfaceColour` + `emptyQuadrant` + `hasOutline`
  to drop a quarter that is bare surface, and `onQuad` in `openCapture` queueing the four in reading order. The old
  file-input path stays as the fallback when there is no camera scanner, and now tolerates fewer than four sleeves.
  Review, placeholders and "Dodaj wszystkie" unchanged. `sw.js` cache `winyle-v9` -> `winyle-v10`.
  Verified here: script parses; 15/15 synthetic squares of four under Node score every quarter correctly (artwork /
  plain black / plain white sleeves, a last row of two, one record alone, sleeves abutting with only seams visible,
  sleeves the colour of the table, unprinted white sleeves on a cream table, bare surface), and a grain sweep shows
  the failure direction is the safe one - heavy grain leaves empty quarters in the review list, it never drops a
  record. The remaining blind spot was measured rather than guessed: a flat sleeve with no edge or shadow within ~8
  levels a channel of the surface colour reads as bare surface. `cropFromVideo` crop maths checked analytically. Codex reviewed the diff read-only three times: it found
  the "Gotowe" press racing an in-flight split and the camera fallback only testing for the API's presence (both
  fixed - `#scanDone` awaits the capture, `onCamFail` routes a dead camera to `doQuad`), and pushed the empty-quarter
  test off the quarter's own edge onto the whole shot's rim. The camera itself still needs the phone - see Pending
- Done 2026-09-27: checked after the Google Cloud clean-up: site 200, Worker `/api/db` and `/api/claude` answer,
  `/api/discogs` still 404 (not added), collection synced 2026-09-13 (5 albums). Nothing depended on Google Cloud
