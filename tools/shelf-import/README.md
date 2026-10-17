# shelf-import — the whole collection in one run

The app's **Import ze zdjęć** does this on the phone. This is the same thing run
from a terminal, for when the photographs are sitting in a folder somewhere
(a Drive download, a card reader) and you would rather not tap through hundreds
of them.

```bash
cd tools/shelf-import && npm ci
node run.js /path/to/photos                 # identify and report, writes nothing
node run.js /path/to/photos --upload        # and push the result to the cloud collection
```

`engine.js` is **lifted verbatim from `index.html`** — the EXIF reader, divider
detection, box grouping, slot numbering, artwork fingerprinting and the cover
crop are the app's own functions, with a small canvas shim so they run in Node.
Lifting rather than reimplementing is the point: the terminal and the phone must
not disagree about where a box ends or whether a sleeve matches.

It keeps the app's rules, including the two that matter most:

- **the stored cover is the photograph that was taken**, never artwork from a
  database;
- a name is written only when the artwork actually matches (distance ≤ 0.62 with
  a ≥ 0.06 gap to the runner-up); anything weaker is uploaded as a placeholder
  holding its slot.

Identification results are cached in `.winyle-identify-cache.json` inside the
photo folder, so a second run costs nothing and you can re-run after fixing a
divider. A full report lands in `winyle-import-report.json` next to the photos.

### The one thing to know before `--upload`

The cloud collection is a single JSON file the Worker commits to git, and it
stops being readable somewhere under a megabyte (see `STATUS.md`). So the covers
are shrunk to the largest size that fits the budget, and that depends on how many
records there are — roughly 400 px for a few dozen, about 96 px for three
hundred. The full-size photographs are **not** uploaded; they stay in the folder
and in the report. If you want full-resolution covers on the phone, run the
import on the phone instead — same engine, same results, it just keeps the
originals locally.

### Dependency

One: `jpeg-js` (pinned), a pure-JavaScript JPEG codec, because Node has no image
decoder and both divider detection and artwork matching need pixels. It is a
tool-only dependency — nothing here is served to the browser, and the app itself
still ships as a single file with no dependencies.
