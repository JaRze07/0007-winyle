# Project7 - Winyle

A vinyl-collection cataloguing app. Pack records into boxes, and the app tracks
exactly which box and which slot each record sits in — so you can always find it
again. Installable on a phone (PWA), with an optional online database so your
collection syncs across devices.

## Adding records

**Packing a whole box — serial scanning.** The camera stays open. Scan a barcode,
move to the next record, scan again — you are never made to wait for a match.
A switch at the top of the viewfinder moves between the three ways of feeding the
same queue — **barcode**, a single **cover** shot, or a **square of four** —
without leaving the camera.
Each record is looked up in the background while you keep going, and you check
the whole batch at the end. Anything that couldn't be identified stays in the
list as a placeholder in its own position, so you can re-scan it or type it in
without losing track of the packing order.

**Four at a time — square after square.** The camera stays open here too. Lay
four sleeves out in a square, press the shutter, lay the next four, press again,
and keep going; the frame shows a 2×2 grid with the corners numbered so you know
which sleeve ends up where. Each shot is split top-left, top-right, bottom-left,
bottom-right and the four go into the queue in that order, identified in the
background while you carry on. A quarter with nothing in it is dropped, so a last
square holding only two records doesn't leave two empty rows behind. You review
the lot at the end, exactly as with serial scanning. On a browser with no camera
scanner the old one-shot route still works: take a single photo with the phone
camera and confirm the split.

**Importing a collection you have already photographed.** Boxes → *Import ze
zdjęć*. Pick every photo at once; the app reconstructs the boxes from them:

- **Order comes from when each photo was taken** (the EXIF timestamp inside the
  file), not from the filename and not from the order the picker hands them over.
  Two photos taken in the same second are separated by the number in the
  filename, which phones write in shutter order.
- **A flat frame ends a box.** Photograph something blank or an evenly coloured
  card — dark orange is what this collection was shot with — between boxes, and
  everything up to it becomes one box. A photo of a sleeve is never flat (it has
  artwork or lettering, and the surface it lies on shows at the edges), so the
  two don't get confused. A flat frame in an unexpected colour is kept as a
  record and flagged, because an extra divider costs one tap and a lost record
  costs a slot.
- **The first photo of a box is its front**, since that is the end you photograph
  from. The app counts slots from the back, so it numbers them the other way
  round. One button flips this if you shot a batch back-to-front.
- **The cover stored for a record is your photograph.** Never artwork fetched
  from a database. Identification is only allowed to fill in artist, title, year
  and genre, and only when the sleeve in the photo actually matches — anything
  less is added as a placeholder that keeps its slot for you to finish by hand.
  Tap any record in the review list to see your photo and the proposed match
  side by side with the artwork distance between them.

A photo the browser cannot open — HEIC, or something that isn't a photo at all —
is **listed in the review screen** rather than quietly skipped, because a missing
photo moves every record behind it up a slot without saying so. If your phone
shoots HEIC, switch the camera to JPEG before photographing a collection.

Nothing is written to the collection until you press the button at the end.

**One at a time**, when that's all you need:

1. **Barcode** — checks MusicBrainz and iTunes, trying every way the number can
   be written (UPC-A, EAN-13, UPC-E, zero-padded), and prefers an album both
   databases agree on.
2. **Cover photo** — identifies the album from the sleeve, then **compares the
   actual artwork** against the candidates before accepting one. If it isn't
   certain, it shows you the covers to choose from rather than guessing.
3. **Manual** — type the details yourself and photograph the sleeve.

Records can be edited afterwards, including placeholders left by a bulk session.

## Syncing

Boxes and records sync in full through the Cloudflare Worker, which commits the
collection to `db/collection.json` in this repo. Artwork is the one thing that
does not go wholesale: the full-size photographs stay on the phone in IndexedDB
(exactly as shot, no size limit), and the cloud copy carries small thumbnails of
them, newest first, inside a fixed budget. Two measured reasons for that:

- the Worker reads the collection back through an API that stops serving the file
  somewhere under a megabyte, so an unbounded push saves but can never be pulled
  (a pull now falls back to the raw file on GitHub, which has no such ceiling);
- every push rewrites the whole file as a new commit, so whatever it carries is
  paid for again on every save.

Settings shows what reached the cloud after each sync. The real fix is to move
the Worker's store off git — see `STATUS.md`.

## Android app

`winyle.apk` on the [Releases page](https://github.com/JaRze07/0007-winyle/releases)
is a Trusted Web Activity: a thin shell around the live site, so **the installed
app updates itself whenever we push**. There is no copy of the app inside the
APK; a new version appears the next time the app is opened, and Settings →
*Pobierz najnowszą wersję* forces it immediately. A new APK is only needed when
the shell itself changes (name, icon, colours, target URL).

Build it from `android-twa/` via the **Android APK** workflow — push a tag
(`v1.1`) or run it from the Actions tab. Signing uses the keystore in repo
secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); its SHA-256 is published in
`.well-known/assetlinks.json`, which is what lets the app run without a browser
address bar. The workflow compares the two and fails if they drift apart.

Other features: drag-to-reorder within a box, box cover = the most recently added
record, a swipe carousel ("what to listen to") filtered by genre/mood that tells
you the box and slot, and search. Genres are not a fixed list — they come from the
records you actually own.

> **Records pressed before the 1980s usually have no barcode at all.** For those,
> the cover photo is the reliable route.

---

## Run it

It's a static site — no build step.

- **Locally:** open `index.html` in a browser. Works on-device (data saved in the
  browser). Note: the **barcode camera** and **install-to-home-screen** need HTTPS,
  so use a real deploy for those.
- **Deploy (recommended):** push to GitHub and enable **GitHub Pages** (Settings →
  Pages → Build from branch → `main` / root). Your app is then live at
  `https://jarze07.github.io/0007-winyle/` over HTTPS — barcode scanning and PWA install
  both work.

## Install on a phone

Open the deployed URL in Chrome (Android) or Safari (iOS) → browser menu →
**Add to Home screen**. It launches full-screen like a native app.

## Online database (optional but recommended)

By default data is stored on-device (browser `localStorage`). To sync online:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project: **SQL Editor → New query**, paste the contents of
   [`schema.sql`](schema.sql), and **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
4. In `index.html`, fill in `CONFIG` near the top of the script:
   ```js
   const CONFIG={ SUPABASE_URL:'https://xxxx.supabase.co', SUPABASE_KEY:'eyJ...', CLAUDE_PROXY:'' };
   ```

Data is written to `localStorage` (fast/offline) and mirrored to Supabase when
configured, so the app keeps working offline and syncs when online. Cover images
are stored as part of the data (base64 for photos, URLs for fetched art).

> The schema's policies give the anon key full read/write — fine for a private
> personal app. Add Supabase Auth + per-user policies before exposing it publicly.

## Optional: better vinyl barcode coverage (Discogs)

Discogs has by far the best vinyl barcode data, but its API needs a token, which
must not sit in the browser. The app already calls `WORKER_URL + '/api/discogs?barcode=…'`
and silently ignores it when the route doesn't exist, so adding that route to your
Worker is enough to switch it on. It should return Discogs' own search response
(`{ results: [{ title, year, genre, thumb, cover_image }] }`).

## Optional: Claude-powered "Find album"

Text search works without any key (iTunes/MusicBrainz). For smarter matching of
messy or partial input — and for identifying a record from a photo of its sleeve —
set `CONFIG.CLAUDE_PROXY` to a small server endpoint that holds your Anthropic API
key and forwards the request (the key must **not** live in the browser). The
endpoint receives `{ "query": "artist — title" }`, optionally with an `image`, and
should return `{ "artist","title","year","genre" }`.

Note that the photo route does not simply trust that answer: it uses it to gather
candidates, then compares their artwork with your photo and only accepts a clear
winner.

Minimal Cloudflare Worker example:
```js
export default {
  async fetch(req, env) {
    const { query } = await req.json();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type":"application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 300,
        system: "Identify the album. Reply ONLY with JSON: {artist,title,year,genre}. genre = one word. Empty strings if unknown.",
        messages: [{ role: "user", content: query }]
      })
    });
    const d = await r.json();
    const text = (d.content||[]).map(b=>b.text||"").join("");
    const m = text.match(/\{[\s\S]*\}/);
    return new Response(m?m[0]:"{}", { headers: { "content-type":"application/json", "access-control-allow-origin":"*" } });
  }
}
```

---

## Push this to GitHub

Create an empty repo named **winyle** on GitHub first (github.com → New repository,
no README), then from this folder:

```bash
git init
git add .
git commit -m "Winyle"
git branch -M main
git remote add origin https://github.com/JaRze07/0007-winyle.git
git push -u origin main
```

## Files

- `index.html` — the whole app (UI + logic + storage)
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA (installable, offline shell)
- `schema.sql` — Supabase/Postgres table for the online database
