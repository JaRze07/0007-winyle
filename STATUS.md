# Project7 - Winyle

## Pending

- **Check continuous four-at-a-time on the phone** (the only part that can't be checked here):
  <https://jarze07.github.io/0007-winyle/> → skrzynka → Dodaj płytę → Cztery na raz; shoot three squares in a
  row, then Gotowe — all 12 should appear in packing order and resolve in the background. Also worth timing:
  the background pool is still 3, and a square lands four Claude-proxy lookups at once; raise it to 4 in
  `openCapture` only if the queue, not the proxy, turns out to be the thing waiting.
- **Zaimportuj kolekcję ze zdjęć** (tylko Jacek może to zrobić — zdjęcia są na telefonie):
  aplikacja → Skrzynki → **Import ze zdjęć** → zaznacz wszystkie zdjęcia. Sprawdź w podglądzie, czy przekładki
  podzieliły skrzynki tam, gdzie powinny, i czy pierwsze zdjęcie w skrzynce to przód; dopiero potem „Dodaj".
  Zdjęć nie trzeba nigdzie wysyłać — import działa na telefonie, Dysk nie jest do niczego potrzebny.
- **Zainstaluj APK z Releases** (`winyle.apk`, v1.1 — zbudowany 2026-10-16, patrz Done); starą wersję Winyli
  trzeba najpierw odinstalować (nowy klucz podpisu). Przy odinstalowaniu Chrome może skasować dane strony,
  a aplikacja bez danych pobiera przy pierwszym uruchomieniu kolekcję z chmury — więc najpierw w starej wersji
  Więcej → „Wyślij do chmury" i sprawdź, że w `db/collection.json` jest to, co ma być
- **Sprawdź wersję 13 na telefonie** (po pushu): Więcej → na dole „Wersja 13". Dwie rzeczy, których nie da się
  sprawdzić bez telefonu: (1) w pakowaniu seryjnym zeskanuj 2-3 płyty, wróć „Gotowe" i dotknij obok arkusza albo
  wciśnij wstecz — ma paść pytanie „Lista nie jest jeszcze dodana… Zamknąć i porzucić ją?" (systemowe okienko;
  w Chrome/TWA powinno działać, nie sprawdzone na urządzeniu); (2) tryb samolotowy → zamknij i otwórz aplikację —
  ma się otworzyć z pamięci
- **Worker: przenieś bazę z gita na KV/R2.** Zmierzone: Worker oddaje `/api/db` tylko do ~1 MB (powyżej GET 500),
  a każdy zapis to nowy commit z całym plikiem. Dlatego klient trzyma pełne okładki lokalnie, a do chmury wysyła
  miniatury w limicie 500 kB, i pull ma zapas przez `raw.githubusercontent.com`. To obejście, nie rozwiązanie
- **Jacek (yes/no): a copy of the Worker source turned up on the PC** (2026-11-12): `C:\JR77\_legacy\winyle\worker\index.js` with its `wrangler.toml` (`winyle-api`), dated 24 June 2026, from the old standalone folder where `worker/` was git-ignored. It holds no secrets (keys come from the Worker's environment). It confirms the item below: `Access-Control-Allow-Origin: *`, no check on `/api/claude` or on `POST /api/db`. It still names the repo `JaRze07/winyle`, so whether it is exactly what runs on Cloudflare today is not known. Say **yes** and I commit it as `worker/`, add the `Origin` check, a request limit and a write secret, and prepare the wrangler deploy for you to run (it needs your `wrangler login`)
- **Jacek (decision): a personal e-mail address is in this public repository's history** (in an old User-Agent string; already gone from the current files). Removing it means rewriting history and force-pushing. Say **rewrite**, **make the repo private**, or **leave it**
- **Worker jest otwarty dla każdego, a jego adres jest publiczny** (stoi w `index.html` w publicznym repo, więc
  „dopóki adres jest prywatny" nigdy nie było prawdą). `POST /api/db` bez autoryzacji = każdy może podmienić
  kolekcję; `/api/claude` bez autoryzacji = każdy może wydawać klucz Anthropic. Aplikacja od wersji 13 traktuje
  kopię z chmury jako niezaufaną (czyści i escapuje), więc podmiana nie uruchomi już kodu na telefonie, ale samej
  podmianie i zużyciu klucza zapobiegnie tylko Worker: sprawdzanie `Origin` + limit zapytań na `/api/claude`,
  a na `/api/db` sekret albo logowanie. Do tego czasu warto ustawić limit wydatków na kluczu Anthropic
- **Synchronizacja to „ostatni zapis wygrywa"** — bez scalania i bez numeru wersji. Telefon, który ma już kolekcję,
  nigdy sam nie pobiera; wysyła po każdym zapisie i nadpisuje chmurę. Dwa urządzenia na zmianę nadpisują się
  nawzajem, a `tools/shelf-import --upload` jest widoczny na telefonie dopiero po „Pobierz z chmury". Jedyne
  „cofnij" to historia `db/collection.json`. Prawdziwa poprawka idzie razem z KV/R2: numer rewizji w Workerze
  i odmowa zapisu na starszej. Decyzja Jacka, czy to potrzebne przy jednym telefonie
- **Do decyzji (nie zmieniane, bo to zachowanie aplikacji):** (a) „Pobierz z chmury" zastępuje skrzynki i płyty
  na telefonie bez pytania — dodać potwierdzenie? (b) „Dodaj wszystkie", gdy część pozycji jest jeszcze „w toku",
  zapisuje je jako puste miejsca do uzupełnienia i wynik rozpoznawania przepada — blokować przycisk do końca?
  (c) „Usuń płytę" nie pyta o potwierdzenie (usunięcie skrzynki pyta)
- `db/collection.json` zawiera teraz pięć płyt demo z testowych wysyłek z 2026-10-16/17, w dodatku z podwójnie
  zakodowanymi polskimi znakami („wieczÃ³r"; wysyłka z 2026-09-13 była zakodowana poprawnie, więc to raczej wina
  tego, czym wysyłano w październiku, niż Workera — nie sprawdzone, źródła Workera nie ma w repo). Plik zostanie
  zastąpiony przy pierwszym prawdziwym zapisie z telefonu; jeśli polskie znaki dalej będą zepsute, to Worker
- Add the Discogs barcode route to the Worker
- spec-kit: szkielet jest w repo (`.specify/`, 2026-09-27), ale `constitution.md` to wciąż pusty szablon i nie ma
  żadnego `specs/` — wypełnić przy pierwszej większej funkcji
- Drobne, znane: okładki usuniętych płyt zostają w IndexedDB (nic ich nie sprząta); każde otwarcie arkusza
  dokłada wpis historii, więc „wstecz" po zamknięciu arkusza krzyżykiem wychodzi ze skrzynki; listy renderują
  pełne okładki 600 px także w miniaturach (przy kilkuset płytach może być ciężko na telefonie — zmierzyć);
  strona jest „network-first" bez limitu czasu, więc przy bardzo słabym zasięgu start czeka na sieć

## Specification

No Google Cloud project: `jr07-0007-winyle` was deleted on 2026-09-27, it was never used (the app talks to the
Cloudflare Worker, MusicBrainz, iTunes and Cover Art Archive only). Hosting: GitHub Pages; the box (`jr07 site add`)
is the alternative if Pages ever becomes a limit.

Winyle - vinyl collection catalogue PWA + TWA APK.

**Import ze zdjęć** (2026-10-16). Całą sfotografowaną kolekcję wczytuje się jednym ruchem: kolejność bierze się
z czasu zrobienia zdjęcia (EXIF, z numerem z nazwy pliku jako rozstrzygnięciem remisu w tej samej sekundzie),
jednolicie pomarańczowa albo pusta klatka kończy skrzynkę, a pierwsze zdjęcie w skrzynce to jej przód (aplikacja
numeruje miejsca od tyłu, więc przelicza to odwrotnie; jest przycisk do odwrócenia). **Okładką płyty zostaje
zdjęcie, które zrobił Jacek** - nigdy grafika z bazy; rozpoznawanie może dopisać tylko wykonawcę, tytuł, rok
i gatunek, i tylko gdy okładka faktycznie się zgadza (`identifyPhoto` → `ok`, czyli bliska odległość *i* wyraźna
przewaga nad drugim kandydatem). Wszystko inne wchodzi jako placeholder trzymający swoje miejsce. Nic nie trafia
do kolekcji przed zatwierdzeniem.

**Android.** APK to TWA wokół `https://jarze07.github.io/0007-winyle/`, więc zainstalowana aplikacja aktualizuje
się sama przy każdym pushu - nowy APK jest potrzebny tylko przy zmianie ikony, nazwy albo adresu. Projekt leży
w `android-twa/` (w repo, odtwarzalny), buduje go workflow **Android APK** i podpisuje kluczem z sekretów repo;
SHA-256 tego klucza jest w `.well-known/assetlinks.json` i workflow przerywa build, jeśli oba się rozjadą.

Bulk packing is one camera overlay with three segments — **Kod kreskowy / Okładka / Czwórka** — all feeding one
review queue, so nothing interrupts the packing rhythm. `Czwórka` shows a square guide with a 2x2 grid and the
corners numbered 1-4: lay four sleeves out, press the shutter, lay the next four, press again. Each shot is cut
out of the viewfinder at full guide resolution, split top-left -> top-right -> bottom-left -> bottom-right, and
the four sleeves are queued and identified in the background while you carry on. A quarter that is nothing but
the surface the records lie on is dropped, so a last square holding two records creates two items, not four.
Everything is reviewed at the end; unidentified items can still be added as placeholders that hold their slot.
Phones without `BarcodeDetector`/camera fall back to the previous one-shot file-input split.

**Dane z zewnątrz są niezaufane** (2026-11-11). Kopia w chmurze (każdy może ją zapisać) i odpowiedzi baz/modelu
przechodzą przez `cleanDB` przy wczytaniu, pobraniu i każdym zapisie, a wszystko, co trafia do `innerHTML`,
przez `esc`. Zapis kolekcji na telefonie nie może się nie udać po cichu: nieudany zapis zwalnia miejsce po starych
okładkach i próbuje ponownie, a jeśli dalej się nie da, czerwony pasek zostaje do pierwszego udanego zapisu.
Arkusz z niezapisaną pracą (kolejka skanowania, import przed „Dodaj") pyta przed zamknięciem.

**Synchronizacja**: telefon jest źródłem prawdy i wysyła po każdym zapisie, po jednej wysyłce naraz; nowe urządzenie
pobiera raz, a dane demo nigdy nie są wysyłane same z siebie. Bez scalania — patrz Pending.

**Offline**: `sw.js` trzyma kopię aplikacji; strona idzie najpierw z sieci, ale tylko poprawna odpowiedź zastępuje
kopię, a bez sieci albo przy błędzie hostingu otwiera się kopia. `CACHE` (sw.js) i `BUILD` (index.html) rosną razem.

**Testy**: `node tools/smoke-test/run.js` (Playwright, 49 sprawdzeń, nie dotyka prawdziwego Workera) oraz
`node tools/shelf-import/check-engine.js` (silnik importu w terminalu = funkcje aplikacji, 14/14).

Full description and setup: `README.md` in this repo.

## Done

- Done 2026-11-11: **przegląd całości: bezpieczeństwo, utrata danych, service worker** (wersja 13, `winyle-v13`).
  - Bezpieczeństwo: gatunek, rok, nastrój, adresy okładek i identyfikatory z kopii w chmurze trafiały do
    `innerHTML` bez escapowania — a chmurę może zapisać każdy, kto zna adres Workera (jest w publicznym repo).
    Podstawiona kolekcja uruchamiała kod na telefonie (potwierdzone testem na starej wersji), a ocena `1e9`
    wywracała ekran skrzynki. Teraz `cleanDB` + `esc` wszędzie; `toast` przyjmuje tekst.
  - Utrata danych: (1) nowe urządzenie bez zasięgu zakładało dane demo **i wysyłało je do chmury**, nadpisując
    prawdziwą kolekcję — demo zostaje już tylko lokalnie; (2) pełny `localStorage` był połykany („Zapisano", a po
    restarcie zmian nie ma) — teraz przenosi stare okładki do IndexedDB i ponawia, a w razie porażki ostrzega;
    (3) dotknięcie obok arkusza / wstecz wyrzucało całą zeskanowaną kolejkę albo wczytany import bez pytania,
    a rozpoznawanie w tle leciało dalej do proxy — teraz pyta i zatrzymuje; (4) podwójne dotknięcie „Dodaj
    wszystkie" (i „Dodaj do skrzynki") przy okładkach ze zdjęć dodawało każdą płytę dwa razy; (5) kilka szybkich
    zapisów wysyłało kilka równoległych POST-ów i wygrywał ten, który doszedł ostatni — wysyłki idą po kolei;
    (6) „Pobierz najnowszą wersję" bez sieci kasowało cache i aplikacja nie otwierała się do powrotu zasięgu.
  - Service worker: strona z błędem hostingu (5xx/404) zapisywała się w cache zamiast aplikacji i to ją pokazywał
    offline; adres startowy z `?…` nie trafiał w cache; precache mógł wziąć starą wersję z cache HTTP. Naprawione.
  - `tools/shelf-import`: `--upload` zastępował całą kolekcję w chmurze bez ostrzeżenia — teraz najpierw
    sprawdza i wymaga `--replace`; z User-Agenta zniknął prywatny adres e-mail; brakowało `package-lock.json`,
    więc `npm ci` z README nie działało; doszedł `check-engine.js`.
  - Testy w repo: `tools/smoke-test/run.js` — przed zmianami 12 z 35 sprawdzeń przechodziło, po zmianach 49/49;
    przejście ze starej wersji (v12 → v13) sprawdzone osobno: dane zostają, stary cache znika.
  - Sekrety: w drzewie i w dostępnej historii nie ma kluczy ani tokenów; jedyna dana osobowa to wspomniany e-mail
    (zostaje w historii gita w `tools/shelf-import/run.js`). Wbudowane tło JPEG nie ma EXIF.
  - Dokumentacja: README (synchronizacja, offline, testy, nieaktualne fragmenty), CLAUDE.md (mapa plików, zasady,
    wycofany `docsync`), STATUS. „Add spec-kit scaffold" zdjęte z Pending — szkielet jest od 2026-09-27.
  - Nie sprawdzone tutaj: telefon (aparat, okienko potwierdzenia w TWA) i żywy Worker (sieć zablokowana).

- Done 2026-10-16: **import całej kolekcji ze zdjęć + aplikacja na Androida.**
  - `index.html`: silnik importu (`captureTime`/`exifFromBuffer` - własny parser EXIF, `frameStats`/`classifyFrame`
    - wykrywanie przekładek, `groupIntoCases`/`positionsFor` - skrzynki i miejsca) oraz ekrany `openImport`:
    wczytywanie z podglądem postępu, rozpoznawanie w tle (pool 3), przegląd pogrupowany w skrzynki z numerami
    miejsc, podgląd „Twoje zdjęcie obok dopasowania" z procentem, zamiana przekładki na płytę i odwrotnie,
    nazwy skrzynek, odwracanie przód/tył, zapis dopiero na koniec.
  - Okładki: pełne zdjęcia przeniesione z `localStorage` (limit ~5 MB, cichy błąd przy przepełnieniu - import
    setek okładek gubiłby grafiki) do **IndexedDB**, ze odczytem starych kluczy i migracją przy pierwszym użyciu.
  - Sync: `cloudPush` wysyła miniatury (128 px) w limicie 500 kB zamiast pełnych okładek, `cloudPull` ma zapas
    przez `raw.githubusercontent.com`, a Ustawienia pokazują, co naprawdę poszło do chmury.
  - `android-twa/` + `.github/workflows/android-release.yml`: podpisany APK na Releases, nowy klucz (stary
    keystore nie istnieje), odcisk w `assetlinks.json`, stary `winyle.apk` usunięty z repo.
  - Sprawdzone pod Node: parser EXIF (little/big endian, brak subsekund, `DateTime` z IFD0, ucięty plik, nie-JPEG),
    kolejność przy tej samej sekundzie, grupowanie (przekładki wiodące/podwójne/końcowe nie robią pustych skrzynek),
    numeracja miejsc w obie strony - 17/17; wykrywanie przekładek na syntetycznych klatkach (karta pomarańczowa
    równo i w cieniu, biała, czarna, szara vs. okładka z grafiką, czarna, biała, pomarańczowa z napisem,
    pełnoklatkowa) - 11/11, z flat-blue świadomie zachowanym jako płyta; cały przebieg importu w jsdom na plikach
    z prawdziwym EXIF (nazwy malejące przeciw czasom) - 25/25, w tym że w chmurze/kolekcji **nie ląduje żaden
    URL grafiki z bazy**, że każda płyta dostaje swoje własne zdjęcie i że miejsce 1 to ostatnie zrobione zdjęcie.
  - Codex przejrzał diff trzy razy (read-only) i znalazł siedem prawdziwych błędów, wszystkie naprawione:
    miniatura z chmury nadpisywała lokalny oryginał okładki, zapis do IndexedDB raportował sukces przed
    commitem transakcji, spóźniony wynik rozpoznawania kasował ręczną poprawkę, subsekundy EXIF porównywane
    bez dopełnienia („9" to .900 s, nie 9 ms), samo otwarcie i zamknięcie karty płyty gubiło wynik, który
    przyszedł w trakcie, migracja okładek nie zwalniała miejsca w `localStorage`, a nazwa skrzynki wracała
    do domyślnej po usunięciu pierwszego zdjęcia. Jeden zarzut odrzucony: ręczny wybór okładki *jest*
    potwierdzeniem, więc może ustawić `ok`.
  - APK: workflow przeszedł (run 38976823515), `winyle.apk` 449 kB wisi w Release **v1.1**. Sprawdzone na
    pobranym pliku: podpisany, odcisk zgodny z `assetlinks.json` (8C:E7:02:…), w zasobach jest żywy adres
    `/0007-winyle/` i nie ma starego `/winyle/`; `assetlinks.json` z nowym odciskiem jest już na Pages.
    `android-actions/setup-android@v3` nie działa (żąda nieistniejącego pakietu `tools`) — build używa SDK
    z obrazu runnera i przypiętego Gradle 8.9.
  - Zdjęcia, których przeglądarka nie otworzy (HEIC, przypadkowe pliki), są **wypisane w podglądzie**, nie
    znikają po cichu — brakujące zdjęcie przesunęłoby wszystkie płyty za nim o jedno miejsce.
  - Nie sprawdzone tutaj: sam aparat i instalacja APK na telefonie.
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
