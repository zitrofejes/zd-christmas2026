# ZD Christmas 2026 – RSVP page

A small, static RSVP page for colleagues. Every response is written to the
**ZD Christmas 2026 - RSVP** Google Sheet through a Google Apps Script web app.
No server, database or paid hosting is needed.

```
index.html / styles.css / app.js   → the page (host anywhere, e.g. GitHub Pages)
config.js                          → event details + the Apps Script URL
apps-script/Code.gs                → backend that writes to the Google Sheet
```

## What it does

- Event details, live countdown and an optional "N people are coming" headcount
- Yes / Maybe / No choice, name, work email, department, plus one, dietary needs, message
- Re-submitting with the same email **updates** the existing row instead of duplicating it
- "Add to calendar" (.ics) download after replying
- Spam honeypot, input validation and formula-injection protection on the server
- Works on mobile, keyboard accessible, respects reduced-motion settings

## Setup (about 10 minutes)

### 1. Add the script to the Google Sheet

1. Open the [RSVP sheet](https://docs.google.com/spreadsheets/d/1CcBkeTsa8yyFMmrXhJU_GHoxl7slZbYr4GRSBhyjaNE/edit).
2. Go to **Extensions → Apps Script**.
3. Delete the placeholder code and paste in the contents of `apps-script/Code.gs`. Save.

The script writes the header row itself on the first submission.

### 2. Deploy it as a web app

1. In Apps Script click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone *(needed so the page can post to it; if every
     colleague is signed into a company Google account you can pick
     "Anyone within <your organisation>" instead, but then people must be signed in)*
4. Click **Deploy**, approve the permissions prompt, and copy the **Web app URL**
   (ends in `/exec`).

### 3. Configure the page

Open `config.js` and fill in:

- `scriptUrl` – the Web app URL from step 2
- `start` / `end`, `venue`, `rsvpDeadline`, `tagline`, `contactName`, `contactEmail`

### 4. Publish the page

**GitHub Pages:** push this repo to GitHub, then **Settings → Pages → Deploy from
a branch → `main` / root**. The page appears at
`https://<org-or-user>.github.io/<repo>/` after a minute.

Any static host works too (Netlify, an internal web server, Google Sites embed, etc.).

### Test locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating the script later

After editing `Code.gs`, use **Deploy → Manage deployments → Edit (pencil) →
Version: New version → Deploy**. This keeps the same URL. Creating a *new*
deployment would give you a new URL that you'd need to put in `config.js`.

## Sheet columns

`Timestamp · Name · Email · Department · Attending · Plus one · Plus one name ·
Dietary requirements · Message · Last updated`

## Privacy note

The Apps Script URL only accepts new RSVPs and returns the headcount; it never
returns names or emails. Set `showHeadcount: false` in `config.js` if you'd rather
not show the number.
