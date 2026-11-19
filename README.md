# ZD Christmas 2026 – RSVP page

A static RSVP page for colleagues, hosted on GitHub Pages. People sign in with their
Zitro Google account, and their reply is stored in **Cloud Firestore** (Firebase free tier).
An organiser page lists every reply and exports them as CSV.

```
index.html          → the RSVP page
admin.html          → organiser view (table, totals, CSV download)
config.js           → event details + Firebase web settings
styles.css
js/app.js           → RSVP page logic
js/admin.js         → organiser page logic
js/backend.js       → picks Firebase or demo mode, shared helpers
js/firebase-backend.js
js/demo-backend.js  → fake backend used until Firebase is configured
firestore.rules     → who can read/write what (the actual security)
firebase.json       → only needed if you deploy rules with the Firebase CLI
```

## How it's secured

The page is public HTML, but the data isn't. Everything is enforced by
[`firestore.rules`](firestore.rules) on Google's servers, not by the page:

- **Only signed-in `@zitrogames.com` Google accounts** can read or write anything.
- **Each person can only read and change their own reply.** The reply is stored under
  their sign-in ID and must carry their sign-in email, so nobody can answer as a colleague.
- **The headcount** comes from a separate `counts` collection that holds only a number
  (0, 1 or 2) per person, never names. The rules check it matches that person's reply.
- **Only organisers can see all replies.** An organiser is any account with a document in
  the `organisers` collection, which can only be edited in the Firebase console, so
  organiser emails never appear in this repo.
- Fields are type- and length-checked; nothing can add extra fields.
- The organiser page never renders replies as HTML, and the CSV export neutralises
  cells that would turn into spreadsheet formulas.
- The Firebase settings in `config.js` are not secrets (Firebase web config is designed to be
  public). It's fine for this repo to be public.

## Try it locally (no setup)

While `firebase.apiKey` in `config.js` is empty, the page runs in **demo mode**: a fake
sign-in and fake data stored only in your browser.

```powershell
python -m http.server 8000
```

Open http://localhost:8000 and http://localhost:8000/admin.html. Add `?reset` to the URL to
clear the demo data. Writing the word "fail" in the message box simulates a save error.

## Set up Firebase (about 15 minutes, once)

Use your **Zitro** Google account for all of this, so the data stays under the company's
Google organisation.

1. **Create the project.** Go to https://console.firebase.google.com → *Create a project* →
   name it e.g. `zd-christmas-2026`. Google Analytics isn't needed.
2. **Turn on Google sign-in.** *Build → Authentication → Get started → Sign-in method →
   Google → Enable*, pick a support email, *Save*.
3. **Create the database.** *Build → Firestore Database → Create database* → choose a
   **Europe** location (e.g. `eur3` or `europe-west1`) → *Start in production mode*.
4. **Paste the rules.** In Firestore, open the *Rules* tab, replace everything with the
   contents of [`firestore.rules`](firestore.rules), *Publish*.
5. **Make yourself organiser.** In Firestore *Data* → *Start collection* → collection ID
   `organisers` → *Document ID*: your Zitro email address, exactly as Google shows it,
   lowercase → add any field (e.g. `name` = your name) → *Save*. Repeat for other organisers.
6. **Register the web app.** *Project settings* (gear icon) → *General* → *Your apps* →
   the `</>` (Web) icon → give it a nickname, **don't** tick Firebase Hosting → *Register*.
   Copy `apiKey`, `authDomain`, `projectId` and `appId` into the `firebase` block in
   [`config.js`](config.js).
7. **Allow your web address to sign in.** *Authentication → Settings → Authorized domains →
   Add domain* → your GitHub Pages host, e.g. `zitrofejes.github.io` (no `https://`, no path).
   `localhost` is already allowed for testing.
8. **Test locally** with `python -m http.server 8000`: the demo banner should be gone, and
   *Sign in with Google* should work with your Zitro account and be refused for others.

### Optional hardening

- In the [Google Cloud console](https://console.cloud.google.com/apis/credentials) for the same
  project, open the *Browser key* → *Application restrictions → Websites* and add
  `https://<your-pages-host>/*` and `http://localhost:8000/*`. Other sites then can't use the key.
- Turn on **App Check** in Firebase if you ever see abuse. It isn't needed for an internal event page.

## Publish on GitHub Pages

Push to GitHub, then *Settings → Pages → Build and deployment → Deploy from a branch →
`main` / `(root)`*. The page appears at `https://<user-or-org>.github.io/<repo>/` and the
organiser view at `…/admin.html`.

GitHub Pages on a **private** repo needs a paid GitHub plan. On the free plan the repo must
be public, which is safe here because nothing in it is secret.

**Custom domain:** add it under *Settings → Pages → Custom domain*, then also add it to
Firebase's *Authorized domains* (step 7).

## Changing things

- **Event details:** edit `config.js` and push.
- **Rules:** edit `firestore.rules`, then paste it into the console again (step 4), or
  `firebase deploy --only firestore:rules` if you use the Firebase CLI.
- **Company domain:** it's in `config.js` (`allowedDomain`) **and** in `firestore.rules`
  (`isZitro()`). Change both.
- **Remove a reply:** organisers can delete the person's documents in `rsvps` and `counts`
  in the Firebase console.

## Data and privacy

The page stores name, work email, team, attendance, plus-one name, dietary needs/allergies
and an optional message. Allergy and dietary information counts as health data under GDPR,
so it's only visible to organisers. After the event, export the CSV if you need it and
delete the Firestore data (or the whole Firebase project).

## Limits

The Firebase free (Spark) plan allows 50,000 reads and 20,000 writes per day. An office
RSVP uses a tiny fraction of that, so nothing needs a billing account.
