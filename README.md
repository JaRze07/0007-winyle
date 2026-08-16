# Project7 - Winyle

A vinyl-collection cataloguing app. Pack records into boxes, and the app tracks
exactly which box and which slot each record sits in — so you can always find it
again. Installable on a phone (PWA), with an optional online database so your
collection syncs across devices.

## Adding records

**Packing a whole box — serial scanning.** The camera stays open. Scan a barcode,
move to the next record, scan again — you are never made to wait for a match.
Each record is looked up in the background while you keep going, and you check
the whole batch at the end. Anything that couldn't be identified stays in the
list as a placeholder in its own position, so you can re-scan it or type it in
without losing track of the packing order.

**Four at a time.** Lay four sleeves out in a square and take one photo. They are
read top-left, top-right, bottom-left, bottom-right and go into the queue in that
order.

**One at a time**, when that's all you need:

1. **Barcode** — checks MusicBrainz and iTunes, trying every way the number can
   be written (UPC-A, EAN-13, UPC-E, zero-padded), and prefers an album both
   databases agree on.
2. **Cover photo** — identifies the album from the sleeve, then **compares the
   actual artwork** against the candidates before accepting one. If it isn't
   certain, it shows you the covers to choose from rather than guessing.
3. **Manual** — type the details yourself and photograph the sleeve.

Records can be edited afterwards, including placeholders left by a bulk session.

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
  `https://JaRze07.github.io/winyle/` over HTTPS — barcode scanning and PWA install
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
git remote add origin https://github.com/JaRze07/winyle.git
git push -u origin main
```

## Files

- `index.html` — the whole app (UI + logic + storage)
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA (installable, offline shell)
- `schema.sql` — Supabase/Postgres table for the online database
