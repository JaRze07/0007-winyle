# Project7 - Winyle — at a glance

**What:** A vinyl-collection cataloguing app (Polish UI). Pack records into boxes; the app
remembers which box and which slot each record sits in, so you can always find it again.

**Stack:** Single-file static **PWA** (`index.html` = UI + logic + storage), installable + offline
(`manifest.json`, `sw.js`) · cloud sync + Claude album lookup through a **Cloudflare Worker** ·
TWA Android build (`winyle.apk`) · optional Supabase path (`schema.sql`, unused).

**Highlights:** bulk packing — the camera stays open while records are identified in the
background, and four sleeves can be catalogued from a single square photo. Cover photos are
matched against the **actual artwork**, not just the title, so another record by the same artist
can't slip through. Barcodes are checked against several databases in every digit format.
Plus drag-to-reorder, and a genre/mood "what to listen to" carousel that points you to the box
and slot. Genres are derived from what you actually own.

**Status:** Live — `JaRze07/winyle`, served at `https://jarze07.github.io/winyle/`. No build step.

**Run:** open `index.html` in a browser (barcode camera + install need HTTPS → use GitHub Pages).
Full setup (Worker, Discogs, Claude proxy, install) in [README.md](README.md).
