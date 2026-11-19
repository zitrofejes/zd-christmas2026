// ─────────────────────────────────────────────────────────────
//  Edit this file to set the event details and connect Firebase.
//  Nothing in here is secret: Firebase web config is meant to be
//  public. Access is controlled by firestore.rules.
// ─────────────────────────────────────────────────────────────
window.RSVP_CONFIG = {
  // Firebase console → Project settings → Your apps → Web app → "SDK setup and configuration".
  // While apiKey is empty the page runs in DEMO MODE (fake data saved in your browser only).
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
  },

  // Only Google accounts on this domain can sign in and reply.
  allowedDomain: 'zitrogames.com',

  title: 'ZD Christmas 2026',
  tagline: 'An evening of good food, music and celebrating the year together.',

  // Event time with its UTC offset (+01:00 = Spanish winter time), and the
  // time zone used to display it, so it shows correctly on any device.
  start: '2026-12-11T19:00:00+01:00',
  end: '2026-12-12T00:00:00+01:00',
  timeZone: 'Europe/Madrid',

  venue: "L'Ovella Negra Marina, Carrer de Zamora 78, Barcelona",
  // Optional link for the venue line ('' = plain text).
  venueUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent("L'Ovella Negra Marina, Carrer de Zamora 78, 08018 Barcelona"),
  rsvpDeadline: '2026-12-05', // shown on the page; set to '' to hide

  allowPlusOne: true,
  showHeadcount: true, // "23 people are coming so far" (shown after sign-in)

  contactName: 'Ricsi Fejes',
  contactEmail: '', // optional; turns the footer name into a mailto link (this repo may be public)
};
