// ─────────────────────────────────────────────────────────────
//  Edit this file to set the event details and connect Firebase.
//  Nothing in here is secret: Firebase web config is meant to be
//  public. Access is controlled by firestore.rules.
// ─────────────────────────────────────────────────────────────
window.RSVP_CONFIG = {
  // Firebase console → Project settings → Your apps → Web app → "SDK setup and configuration".
  // While apiKey is empty the page runs in DEMO MODE (fake data saved in your browser only).
  firebase: {
    apiKey: 'AIzaSyBq08Y9pF-3ToJN3OdJ-XzWTGHVOnsWKyE',
    authDomain: 'christmas-unfold.firebaseapp.com',
    projectId: 'christmas-unfold',
    appId: '1:54036825098:web:584a9c0bea47dfd9b3cbf3',
  },

  // Only Google accounts on this domain can sign in and reply.
  allowedDomain: 'zitrogames.com',

  title: 'Christmas Unfold',
  tagline: 'ZD Christmas 2026. Good food, drinks and celebrating the year together.',

  // Price per person in euros (menu: starters to share, a main, 2 drinks).
  price: 26,

  // Optional: a YouTube Data API v3 key for the "Random YouTube video" prize.
  // Without it, the prize opens a random YouTube search instead of a single video.
  youtubeApiKey: 'AIzaSyBhNec7slwhNMpc7SwFapx_FgtjXTK_RKw',

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
