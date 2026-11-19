# Christmas Unfold – ZD Christmas 2026 RSVP

A mobile-first, click-through RSVP for the ZD Christmas party, styled after Luxor Unfold.
Hosted on GitHub Pages at **https://christmasunfold.digital**. Colleagues sign in with their
Zitro Google account; replies are stored in **Cloud Firestore** (Firebase free tier).

**The flow**

1. **Language**: every language of Spain (and English). The whole page really is translated.
2. **Info + log in**: date, venue, price (€26: starters to share, a main, 2 drinks), countdown.
3. **Will you attend?** Yes / Maybe / No. *No* crumbles when pressed; a small
   "Ugh, fine. I really can't come" link then records the No.
   - Yes / Maybe → team + plus one.
4. **Message for the organiser**
5. **Favourite colleague**: whatever you type becomes *Michael Bauer*. Never stored.
6. **Spin the wheel** (one spin per person). Free entry, the microwave (it always slows down there),
   Jira and €100 can never be won. Spin again, song, photo, coffee (max 3 in total), BIG WIN
   and random YouTube video can.
7. **Done**: summary, add to calendar, and the YouTube link if you won one.

The organiser page is at **/admin.html**: totals, coffee winners, songs, a CSV export and the polaroids.
Each reply has **Edit** (name, team, answer, plus one, message, song, and *Reset spin* so the
person can spin again) and **Delete** (removes their reply, spin and photo, and hands a won
coffee back to the pool).

```
index.html, admin.html      the two pages
config.js                   event details, price, Firebase settings, optional YouTube key
css/app.css, css/admin.css
js/app.js                   RSVP flow
js/wheel.js                 the prize wheel
js/fx.js                    snow, crumbling button, polaroids, BIG WIN
js/camera.js                photo capture + compression
js/i18n.js, i18n/*.json     translations (en.json is the source)
js/backend.js               picks Firebase or demo mode
js/firebase-backend.js, js/demo-backend.js
firestore.rules             who can read/write what (the actual security)
assets/                     artwork, icons, link-preview image
tools/make_images.py        regenerates favicon / app icons / og.jpg
CNAME                       custom domain for GitHub Pages
```

## How it's secured

Everything is enforced by [`firestore.rules`](firestore.rules) on Google's servers:

- Only signed-in `@zitrogames.com` Google accounts can read or write anything.
- Each person can only read and change **their own** reply; it must carry their sign-in email.
- The headcount comes from anonymous per-person numbers (0/1/2), checked against the reply.
- **One spin per person**: the wheel result can be written once and never re-rolled.
  Prizes that "can never be won" aren't accepted by the server at all.
- **Coffee**: a shared counter that can only go up by one together with a new coffee win, and
  never past 3.
- **Photos**: only people who won the photo can upload one, only for themselves, only as a
  small JPEG. Any colleague can see them (they float around the page); organisers can delete them.
- Only organisers (accounts listed in the `organisers` collection) see all replies.
- The organiser page never renders replies as HTML; the CSV export neutralises formula cells.

One known limit: the wheel's outcome is picked in the browser (true server-side randomness
needs Cloud Functions, which needs a paid plan). Someone who opens the developer tools could
choose their own prize, but still only once and only from the winnable ones, and coffee stays capped at 3.

## Try it locally (no setup)

While `firebase.apiKey` in `config.js` is empty, the page runs in **demo mode** with a fake
sign-in and sample data saved only in your browser.

```powershell
python -m http.server 8000
```

Open http://localhost:8000 (add `?reset` to start over) and http://localhost:8000/admin.html.
Once Firebase is configured, add `?demo` to a localhost URL (e.g. `http://localhost:8000/admin.html?demo`)
to keep using the demo data instead of the real database.

## 1. Firebase (about 15 minutes, once)

Use your **Zitro** Google account.

1. https://console.firebase.google.com → *Create a project* (e.g. `christmas-unfold`). Analytics isn't needed.
2. *Build → Authentication → Get started → Sign-in method → Google → Enable → Save.*
3. *Build → Firestore Database → Create database* → a **Europe** location → *production mode*.
4. Firestore → *Rules* → paste [`firestore.rules`](firestore.rules) → *Publish*.
5. Firestore → *Data* → *Start collection* `organisers` → *Document ID* = your Zitro email
   (lowercase) → any field, e.g. `name` → *Save*.
6. *Project settings → General → Your apps → `</>` Web* → register (no Hosting) → copy
   `apiKey`, `authDomain`, `projectId`, `appId` into `config.js`.
7. *Authentication → Settings → Authorized domains → Add domain* → `christmasunfold.digital`
   (and `www.christmasunfold.digital`).
8. Test locally: the demo banner disappears and *Log in with Google* works for Zitro accounts only.

## 2. Domain: christmasunfold.digital (Namecheap → GitHub Pages)

1. **GitHub:** push this repo, then *Settings → Pages → Deploy from a branch → `main` / root*.
   The `CNAME` file already contains `christmasunfold.digital`; check that *Custom domain*
   shows it.
2. **Namecheap:** *Domain List → Manage → Advanced DNS*. Delete the default parking records
   (the *URL Redirect* on `@` and the `www` CNAME to `parkingpage…`), then add:

   | Type  | Host | Value                    |
   |-------|------|--------------------------|
   | A     | @    | 185.199.108.153          |
   | A     | @    | 185.199.109.153          |
   | A     | @    | 185.199.110.153          |
   | A     | @    | 185.199.111.153          |
   | CNAME | www  | `<your-github-user>.github.io.` |

3. Wait until GitHub's Pages settings show the DNS check as successful (minutes to a few
   hours), then tick **Enforce HTTPS**.
4. Recommended: *GitHub → your profile Settings → Pages → Add a domain* and add the TXT record
   it shows in Namecheap. This verifies the domain so nobody else can point a Pages site at it.

GitHub Pages on a private repo needs a paid plan; on the free plan the repo must be public,
which is safe because nothing in it is secret.

## 3. Optional: real random YouTube videos

Without a key, the YouTube prize opens a YouTube **search** for a random camera filename
(`IMG_4821`, `MVI_0394`…), which turns up random home videos. To jump straight to a single
random video:

1. [Google Cloud console](https://console.cloud.google.com) → pick the Firebase project →
   *APIs & Services → Library → YouTube Data API v3 → Enable*.
2. *Credentials → Create credentials → API key*. Restrict it: *Websites* =
   `https://christmasunfold.digital/*`, *API restrictions* = YouTube Data API v3.
3. Put the key in `youtubeApiKey` in `config.js`.

Searches use `safeSearch=strict`. The free quota is about 100 prize openings a day.

## Link previews and icons

`index.html` has Open Graph and Twitter tags, so links in WhatsApp, Slack, Google Chat, Teams
and iMessage show the **Christmas Unfold** card (`assets/og.jpg`), plus a favicon and a
home-screen icon. Chat apps cache previews; if an old one shows, paste the link with `?v=2`.
After changing artwork, run `python tools/make_images.py`.

## Changing things

- **Date, venue, price, deadline:** `config.js`. Dates are formatted per language automatically.
  The link-preview image has the date baked in, so rerun `tools/make_images.py` if it changes.
- **Texts:** `i18n/en.json` is the source; each language has its own file with the same keys.
  Missing keys fall back to English.
- **Wheel odds:** `decide()` in `js/app.js`.
- **Coffee limit:** `MAX_COFFEES` in `js/backend.js` **and** `<= 3` in `firestore.rules`.
- **Fix or remove a reply, or reset someone's spin:** use Edit / Delete on the organiser page.
- **Rules:** whenever `firestore.rules` changes, paste it into *Firestore → Rules → Publish* again.
  The site and the rules are deployed separately.

## About the translations

The minority languages and dialects (A Fala, Estremeñu, Llionés, Aranés, Caló, etc.) were
machine-translated, and some of their spellings aren't standardised. They're good enough for
the joke, but worth a glance from a native speaker if one is around.

## Data and privacy

Stored: name and work email (from Google), team, attendance, plus one, message, chosen language,
wheel prize, song and, for photo winners, a small photo. After the event, export the CSV and
delete the Firestore data (or the whole Firebase project).
