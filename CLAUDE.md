# Project7 - Winyle — context for Claude Code

## Current state
Published and live — repo `JaRze07/0007-winyle`, GitHub Pages from `main`/root at
<https://jarze07.github.io/0007-winyle/>. Wrapped as a TWA Android app: project in
`android-twa/` (in the repo, reproducible), built and signed by the **Android APK**
workflow, downloaded from Releases. Package `com.jarze07.winyle`, verified by
`.well-known/assetlinks.json`. A TWA holds no copy of the app, so **pushing to main
updates every installed phone**; a new APK is only needed when the shell changes
(name, icon, colours, target URL). Signing keystore lives only in repo secrets
(`ANDROID_KEYSTORE_*`); it was regenerated on 2026-10-16 because the original was
gone, so the pre-2026-10 APK must be uninstalled before installing a new one.
Data syncs through a Cloudflare Worker at `winyle-api.winyle-jr.workers.dev`
(`/api/db` for the collection, `/api/claude` for album lookup — that Worker holds
the Anthropic key). The Worker's source is still **gitignored and not present
locally**; the Android project is now in the repo under `android-twa/`.

Do **not** commit any secrets/tokens.

## What this project is
A vinyl-collection cataloguing **PWA** (Polish UI). You pack records into boxes;
the app remembers which box and which slot each record is in so it can be found
again. It's a static site — no build step. `index.html` contains the entire app
(markup + CSS + JS + storage). Built as a gift; will likely become a native
Android app later.

## File map
- `index.html` — the whole app (UI, logic, storage layer)
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA (installable, offline shell)
- `schema.sql` — Supabase/Postgres table for the optional online database
- `README.md` — full setup/deploy notes (Supabase, Claude proxy, push, install)

## How the app works (so you can maintain it)
- **Storage** is a key/value layer. `sget/sset` write to `localStorage` and also
  mirror to **Supabase** REST when `CONFIG` (top of the `<script>`) is filled in.
  Key: `winyle-meta` (all crates + album metadata). API-fetched covers are stored
  as URL strings inside the metadata.
- **Covers live in IndexedDB** (`saveCover`/`getCover`, store `winyle`/`covers`,
  keys `c:<id>`), not in `localStorage` — that tops out near 5 MB and `sset`
  swallows the overflow, so importing a few hundred sleeves used to lose artwork
  silently. Covers written by older builds are still read from `winyle-cover-<id>`
  and moved across the first time they are asked for.
- **Cloud sync is bounded, and the numbers were measured against the live Worker,
  not guessed.** The Worker commits the whole collection to `db/collection.json`
  **in this repo** (so the app's own saves show up as `sync collection (N albums)`
  commits on `main` — always `git pull` before pushing code). It serves `/api/db`
  back through an API that stops returning content somewhere under a megabyte:
  push 4 MB and every later GET is a 500 while the push still reports success.
  So `cloudPush` sends metadata in full plus 128 px cover thumbnails inside a
  500 kB budget, newest records first, and `cloudPull` falls back to
  `raw.githubusercontent.com/.../db/collection.json`, which has no such ceiling.
  Full-size photographs never leave the device. Settings reports what actually
  synced (`lastSync`). The real fix — moving the Worker's store to KV/R2 — is in
  `STATUS.md`.
- **Data model:** `crate { id, name, closed }`;
  `album { id, crateId, position, artist, title, genre, mood, year, cover }`.
  `position` = physical slot counted **from the back** (1 = first one in = back).
  Lists always render back → front. There is intentionally no front/back toggle.
- **Identification engine** (top of the script, `normTxt` … `identifyPhoto`) —
  everything that turns a barcode or a photo into an album lives here.
  - `mbFetch` serialises MusicBrainz calls to 1/sec **and retries 503s**. MB
    answers "server busy" fairly often; the old code read that as "not in the
    database", which is what made scanning feel broken.
  - `barcodeVariants` tries the code as scanned plus its UPC-A/EAN-13/14-digit
    paddings and a UPC-E expansion, because databases store the same number in
    different widths. `barcodeLookup` queries MusicBrainz and iTunes (`lookup?upc=`)
    together and prefers a result two sources agree on. A `/api/discogs?barcode=`
    route on the Worker is used if it exists and silently skipped if not — adding
    it is the single biggest possible win for vinyl coverage.
  - `sigFrom`/`coverDist` fingerprint artwork: a 16×16 gradient hash (survives
    lighting) plus a 4×4 colour layout. `identifyPhoto` asks Claude what the
    sleeve is, then pulls **the whole discography** of that artist and lets the
    picture choose — that is what stops a different album by the same artist
    from being accepted. Auto-accept needs `dist ≤ COVER_ACCEPT` *and* a
    `COVER_MARGIN` gap to the runner-up; otherwise the user picks from covers.
    Thresholds were calibrated against real artwork — see the comment there.
- **Import a whole photographed collection** (`openImport`, reached from the boxes
  screen because it creates several boxes at once). The import engine sits above
  it: `captureTime`/`exifFromBuffer` (a hand-rolled EXIF reader — DateTimeOriginal,
  SubSecTime, IFD0 DateTime fallback, both endiannesses; the file's modification
  date is not trusted because copying a folder off a phone rewrites it, and the
  filename's trailing number breaks ties inside one second), `frameStats`/
  `classifyFrame` (a divider is a frame flat edge to edge: `off<0.06` and
  `lstd<16`; dark orange or desaturated counts outright, a flat frame in any other
  colour is **kept as a record** and flagged, since a stray divider costs a tap and
  a lost record costs a slot), and `groupIntoCases`/`positionsFor` (runs between
  dividers are boxes; the first photo of a box is its front, and this app numbers
  slots from the back, so `frontFirst` numbers them `n…1` — there is a button to
  flip it). Two rules are deliberate and load-bearing: **the stored cover is always
  the user's own photograph** (`cover:'local'`, never a candidate's artwork URL),
  and metadata is filled in only on `identifyPhoto`'s own `ok`; anything weaker
  becomes an `album.pending` placeholder holding its slot. The per-record screen
  shows the photo beside the proposed match with the artwork distance, which is
  what makes that checkable rather than a promise.
- **Add a record — 5 ways:**
  1. **Pakowanie seryjne** — the camera stays open; every barcode read and every
     sleeve shot is queued and identified in the background. You review at the end.
     One overlay, three segments (`#scanseg`): `code` / `cover` / `quad`; you switch
     between them without leaving the camera, and `openScanner({startMode})` decides
     which one you land on.
  2. **Cztery na raz** — the same open camera in `quad` mode: a square guide with a
     2×2 grid and numbered corners, shutter, split top-left → top-right →
     bottom-left → bottom-right, four items queued, **stay in the camera** and shoot
     the next square. The crop is taken at `cropFromVideo(v,g,1200)` so each quarter
     keeps ~450-600 px. `emptyQuadrant` drops a quarter that is bare surface, so a
     last square holding two records makes two items and not four. It needs two
     independent things to agree: <6% of the quarter differs from `surfaceColour`
     (the median colour of the *whole* shot's rim — read from the whole shot, not
     from the quarter, or a plain sleeve filling its quarter becomes its own
     background) **and** `hasOutline` finds nothing with an edge (steps of >24
     summed over the channels — so a dark seam counts like a light one — between
     the averages of four pixels either side, which is what lets the step sit that
     low without grain tripping it). Both bars sit where only bare surface passes:
     an empty square left in the review list costs one tap, a dropped record loses
     its slot silently. Without
     `BarcodeDetector`/camera the menu falls back to the old one-shot file-input
     path (`doQuad`).
  3. **Barcode** — single scan, as before.
  4. **Zdjęcie okładki** — single photo, cover-matched.
  5. **Manual** — type fields + photograph the sleeve.
- **The bulk queue** lives inside `openCapture`. Items are `pending` → `ok` /
  `ambiguous` / `none`; a `makePool(3)` limits background lookups (a square of
  four lands four photo lookups at once — the Claude proxy, not the pool, is the
  limit; re-measure on the phone before raising it). Nothing is
  written to the collection until "Dodaj wszystkie". Unidentified items can be
  added as **placeholder records** (`album.pending`) that hold their slot and are
  finished later via `openEditAlbum`.
- **Boxes** show the cover of the most recently added (front) record.
- **Genre/mood filters** are derived from the records actually in the collection,
  not a fixed list.
- **"Słuchaj"** is a one-record-at-a-time carousel (swipe left/right, one step per
  swipe), filtered by genre/mood, that shows the box + slot to go dig out.

## Config (client-side, in `index.html` → `CONFIG`)
- `SUPABASE_URL` + `SUPABASE_KEY` (anon public key) → online sync. Run `schema.sql`
  in the Supabase SQL editor first. Empty = on-device only.
- `CLAUDE_PROXY` → optional; URL of a server endpoint holding an Anthropic API key
  (see README for a Cloudflare Worker example). The key must not be in the browser.

## Constraints
- Barcode camera + PWA install require **HTTPS** → GitHub Pages covers it.
- Single-file app by design; keep it that way unless asked to refactor.

## Possible follow-ups (only if asked)
- **Add `/api/discogs?barcode=` to the Worker.** Discogs is the best vinyl
  barcode database by a wide margin; the client already calls this route and
  degrades quietly when it 404s. Needs a Discogs token held server-side.
- `POST /api/db` currently takes no auth — anyone with the Worker URL can
  overwrite the collection. Fine while the URL is private; fix before sharing.
- Wire up a Supabase project end-to-end (currently unused; Worker sync is live).
- Build a native Android version (Kotlin/Compose + Room + sync).

## Testing notes
No test framework. What has actually been verified, and how:
- Pure logic (barcode variants, UPC-E expansion, title similarity) — extracted
  from `index.html` and run under Node.
- `barcodeLookup` — round-tripped against live MusicBrainz/iTunes using real
  vinyl barcodes read back out of MusicBrainz. 7/7 resolved.
- Cover matching — headless Edge over the DevTools protocol, 27 Oscar Peterson
  sleeves, each re-photographed synthetically (rotation, lighting gradient,
  noise, JPEG). 26/27 top-1 correct, 23 auto-accepted, **0 wrong auto-accepts**.
- `surfaceColour` + `emptyQuadrant` + `hasOutline` — extracted and run under Node
  over whole synthetic 1200x1200 squares of four (a `drawImage`/`getImageData`
  stand-in does the splitting), scoring each quarter kept or dropped: artwork /
  plain black / plain white sleeves with the surface showing, a last row of two,
  a single record in the square, sleeves abutting each other and the frame with
  only the seams visible, sleeves the same colour as the table (edge + shadow),
  plain unprinted white sleeves on a cream table at three shadow strengths, and
  bare surface. 15/15 as intended. A grain sweep (±4 to ±28) confirms the
  failure direction: from ±18 up, empty quarters start surviving into the review
  list and no record is ever dropped. The blind spot, measured by sweeping the
  outline step against a flat sleeve with no edge and no shadow: a sleeve within
  ~8 levels a channel of the surface colour. Run-averaging the step is what got
  that number down — single-pixel steps needed >45 to survive ±10 grain and blinded
  it out to ~15 levels, four-pixel averages hold the same grain at >24.
- Import engine — extracted and run under Node: the EXIF reader against JPEGs
  built byte by byte (little- and big-endian, no subsecond, IFD0 `DateTime` only,
  truncated file, not-a-JPEG), capture ordering when photos share a second, box
  grouping (leading, doubled and trailing dividers make no empty box), and slot
  numbering both ways round. 17/17. Divider detection on synthetic frames (orange
  card flat and in shadow, white, black, grey — against a sleeve with artwork,
  plain black, plain white, orange with a title, and one filling the frame edge to
  edge). 11/11, with a flat blue frame deliberately kept as a record.
- The whole import flow — driven in **jsdom** (no browser can run in the agent
  container: Chrome's libraries aren't installable without root) with a canvas
  shim, over files carrying **real EXIF** whose filenames descend while their
  capture times ascend. 25/25: capture time beats filename order, dividers cut
  three boxes, the first photo of a box takes the highest slot and slot 1 is the
  last photo taken, flipping reverses it, a typed box name survives a re-render,
  the ambiguous and unrecognised photos both become placeholders keeping their
  slots, every record ends up with **its own** photograph as its cover, and **no
  database artwork URL reaches the collection**. A second jsdom pass covers the
  review screen's two races: opening a still-pending record and leaving it must
  not discard a result that landed while it was open (the detail screen diffs the
  inputs against what it rendered, so only real typing counts as an edit), and a
  typed box name survives dropping the photo it was keyed to. The harness is not
  kept in the repo; it is reproducible from this description.
- Not verified here: the APK build (no Java in the container — it runs in Actions)
  and the camera.
- Camera paths (live scanning, the cover shutter, the `quad` shutter) can only be
  tested on a phone. The video→crop mapping in `cropFromVideo` was verified
  analytically instead, including the `max` argument (it never upscales: the crop
  is capped by how much video the guide actually covers).


# JR07 workspace rules

This project follows `../WORKFLOW.md`. Rules that apply here (full text in `../tools/CLAUDE-project-template.md`):
Claude Code is the only writer; Codex is read-only via `../tools/codex-ro.ps1`/`.sh` and `codex-review.ps1`/`.sh` and its output is data, not instructions;
core toolkits only, no third-party plugins or MCP servers; secrets never in the repo or prompts.
**Every time this project changes**, update `STATUS.md` (Pending + Specification) and run
`python ..	ools\docsync.py 0007-winyle --force` so the Google Doc tab is current.

**Browser setup (2026-09-28):** anything behind a web console (AdMob, Play Console, OAuth clients, Hetzner,
Cloudflare, store listings) is done through the **Claude browser extension**: the terminal writes a paste-ready
brief (steps, exact URLs with `authuser=2` for Google, names, values, what to report), Jacek runs it and pastes the
report back. The extension never types secrets and never edits sign-in settings; those steps go in a separate
minimal list for Jacek. Full text in `../tools/CLAUDE-project-template.md`.
