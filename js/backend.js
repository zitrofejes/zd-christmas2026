// Picks the real Firebase backend when config.js has Firebase settings,
// otherwise a local demo backend so the page can be previewed without setup.

export async function getBackend(C) {
  const f = C.firebase || {};
  const mod = f.apiKey && f.projectId
    ? await import('./firebase-backend.js')
    : await import('./demo-backend.js');
  return mod.create(C);
}

/** People this reply adds to the headcount. Must match expectedCount() in firestore.rules. */
export function heads(d) {
  return d.attending === 'Yes' ? (d.plusOne ? 2 : 1) : 0;
}

/** Wheel prizes that can actually be stored. Must match the list in firestore.rules. */
export const WINNABLE = ['song', 'photo', 'coffee', 'bigwin', 'youtube'];
export const MAX_COFFEES = 3;

/** Keep only the reply fields a person can edit, with the right types. */
export function pick(d) {
  return {
    attending: String(d.attending || ''),
    name: String(d.name || ''),
    department: String(d.department || ''),
    plusOne: !!d.plusOne,
    message: String(d.message || ''),
    language: String(d.language || 'en'),
  };
}

/** Turns Firebase error codes into something a colleague can act on ('' = say nothing). */
export function friendly(err) {
  const code = (err && err.code) || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups for this page and try again.';
  if (code === 'auth/unauthorized-domain') return 'This web address is not allowed to sign in yet (Firebase → Authentication → Settings → Authorized domains).';
  if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') return 'Google sign-in is not switched on for this Firebase project yet.';
  if (code === 'permission-denied') return 'You don\'t have access to this.';
  if (code === 'unavailable') return 'Could not reach the server. Please check your connection and try again.';
  return (err && err.message) || 'Something went wrong. Please try again.';
}
