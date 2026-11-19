// Demo backend used while config.js has no Firebase settings.
// Everything is stored in this browser only. Add ?reset to the URL to start over.
import { heads, pick } from './backend.js';

const KEY = 'zd-rsvp-demo';
const SESSION = 'zd-rsvp-demo-signed-in';
const USER = { uid: 'demo', email: 'your.name@zitrogames.com', name: 'Your Name' };

const SAMPLE = [
  { name: 'Ana García', email: 'ana.garcia@zitrogames.com', department: 'Art', attending: 'Yes', plusOne: true, plusOneName: 'Marc', dietary: 'Vegetarian', message: 'Can\'t wait!' },
  { name: 'Jordi Puig', email: 'jordi.puig@zitrogames.com', department: 'Maths', attending: 'Maybe', plusOne: false, plusOneName: '', dietary: '', message: '' },
  { name: 'Laura Martín', email: 'laura.martin@zitrogames.com', department: 'QA', attending: 'No', plusOne: false, plusOneName: '', dietary: '', message: 'Have fun everyone' },
  { name: 'Péter Kovács', email: 'peter.kovacs@zitrogames.com', department: 'Development', attending: 'Yes', plusOne: false, plusOneName: '', dietary: 'Nut allergy', message: '' },
];

if (location.search.includes('reset')) {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); } catch (e) {}
}

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

export async function create() {
  let listener = () => {};
  const signedIn = () => { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; } };
  const emit = () => listener(signedIn() ? USER : null);

  return {
    demo: true,
    onUser(cb) { listener = cb; setTimeout(emit, 300); },
    async signIn() { await wait(400); try { sessionStorage.setItem(SESSION, '1'); } catch (e) {} emit(); },
    async signOut() { try { sessionStorage.removeItem(SESSION); } catch (e) {} emit(); },
    async load() { await wait(); const r = read(); return r ? pick(r) : null; },
    async save(user, data) {
      await wait(700);
      if (/\bfail\b/i.test(data.message)) throw new Error('Demo failure: the message contained the word "fail".');
      const old = read();
      const now = new Date().toISOString();
      write({ ...pick(data), email: user.email, createdAt: old ? old.createdAt : now, updatedAt: now });
      return { updated: !!old };
    },
    async headcount() {
      await wait(300);
      const mine = read();
      return SAMPLE.reduce((n, r) => n + heads(r), 0) + 19 + (mine ? heads(mine) : 0);
    },
    async listAll() {
      await wait();
      const day = 86400000;
      const rows = SAMPLE.map((r, i) => ({ ...r, createdAt: new Date(Date.now() - (i + 2) * day), updatedAt: new Date(Date.now() - (i + 1) * day) }));
      const mine = read();
      if (mine) rows.unshift({ ...mine, createdAt: new Date(mine.createdAt), updatedAt: new Date(mine.updatedAt) });
      return rows;
    },
  };
}
