// Demo backend used while config.js has no Firebase settings.
// Everything is stored in this browser only. Add ?reset to the URL to start over.
import { heads, pick, MAX_COFFEES } from './backend.js';

const KEY = 'zd-rsvp-demo-v2';
const SESSION = 'zd-rsvp-demo-signed-in';
const USER = { uid: 'demo', email: 'your.name@zitrogames.com', name: 'Your Name' };

// A tiny grey "photo" so the polaroid wall isn't empty in demo mode.
function samplePhoto(hue) {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 150;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 150);
  g.addColorStop(0, `hsl(${hue} 45% 70%)`); g.addColorStop(1, `hsl(${hue} 40% 35%)`);
  x.fillStyle = g; x.fillRect(0, 0, 120, 150);
  x.fillStyle = 'rgba(255,255,255,.85)';
  x.beginPath(); x.arc(60, 62, 24, 0, 7); x.fill();
  x.beginPath(); x.ellipse(60, 140, 42, 40, 0, Math.PI, 0); x.fill();
  return c.toDataURL('image/jpeg', 0.7);
}

const SAMPLE = [
  { name: 'Ana García', email: 'ana.garcia@zitrogames.com', department: 'Art', attending: 'Yes', plusOne: true, message: 'Can\'t wait!', language: 'ca', prize: 'photo', song: '' },
  { name: 'Jordi Puig', email: 'jordi.puig@zitrogames.com', department: 'Maths', attending: 'Maybe', plusOne: false, message: '', language: 'val', prize: 'song', song: 'Mariah Carey – All I Want for Christmas Is You' },
  { name: 'Laura Martín', email: 'laura.martin@zitrogames.com', department: 'QA', attending: 'No', plusOne: false, message: 'Have fun everyone', language: 'and', prize: 'bigwin', song: '' },
  { name: 'Péter Kovács', email: 'peter.kovacs@zitrogames.com', department: 'Development', attending: 'Yes', plusOne: false, message: '', language: 'en', prize: 'coffee', song: '' },
];

if (location.search.includes('reset')) {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); localStorage.removeItem('zd-lang'); } catch (e) {}
}

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

export async function create() {
  let listener = () => {};
  const signedIn = () => { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return false; } };
  const emit = () => listener(signedIn() ? USER : null);
  const sampleCoffees = SAMPLE.filter((s) => s.prize === 'coffee').length;
  const coffees = () => sampleCoffees + (read().spin && read().spin.prize === 'coffee' ? 1 : 0);
  let photos;

  return {
    demo: true,
    onUser(cb) { listener = cb; setTimeout(emit, 200); },
    async signIn() { await wait(); try { sessionStorage.setItem(SESSION, '1'); } catch (e) {} emit(); },
    async signOut() { try { sessionStorage.removeItem(SESSION); } catch (e) {} emit(); },

    async load() {
      await wait();
      const db = read();
      return { rsvp: db.rsvp ? pick(db.rsvp) : null, spin: db.spin || null, coffees: coffees() };
    },

    async saveRsvp(user, data) {
      await wait(500);
      if (/\bfail\b/i.test(data.message)) throw new Error('Demo failure: the message contained the word "fail".');
      const db = read();
      const now = new Date().toISOString();
      const updated = !!db.rsvp;
      db.rsvp = { ...pick(data), email: user.email, createdAt: updated ? db.rsvp.createdAt : now, updatedAt: now };
      write(db);
      return { updated };
    },

    async headcount() {
      await wait(200);
      const db = read();
      return SAMPLE.reduce((n, r) => n + heads(r), 0) + 19 + (db.rsvp ? heads(db.rsvp) : 0);
    },

    async coffeeCount() { await wait(150); return coffees(); },

    async saveSpin(user, prize) {
      await wait(300);
      const db = read();
      if (db.spin) throw Object.assign(new Error('Already spun'), { code: 'permission-denied' });
      if (prize === 'coffee' && coffees() >= MAX_COFFEES) throw Object.assign(new Error('No coffees left'), { code: 'coffee-gone' });
      db.spin = { prize, song: '' };
      write(db);
    },

    async saveSong(user, song) { await wait(300); const db = read(); db.spin.song = song; write(db); },

    async savePhoto(user, data, name) { await wait(400); const db = read(); db.photo = { data, name }; write(db); photos = null; },

    async listPhotos() {
      await wait(200);
      if (!photos) photos = [{ id: 'a', name: 'Ana García', data: samplePhoto(200) }, { id: 'b', name: 'Péter Kovács', data: samplePhoto(30) }];
      const mine = read().photo;
      return mine ? [{ id: 'demo', ...mine }, ...photos] : photos;
    },

    async listAll() {
      await wait();
      const day = 86400000;
      const rows = SAMPLE.map((r, i) => ({ id: 's' + i, ...r, createdAt: new Date(Date.now() - (i + 2) * day), updatedAt: new Date(Date.now() - (i + 1) * day) }));
      const db = read();
      if (db.rsvp) {
        rows.unshift({ id: 'demo', ...db.rsvp, prize: db.spin ? db.spin.prize : '', song: db.spin ? db.spin.song : '',
          createdAt: new Date(db.rsvp.createdAt), updatedAt: new Date(db.rsvp.updatedAt) });
      }
      return rows;
    },

    async deletePhoto(id) {
      await wait(200);
      if (id === 'demo') { const db = read(); delete db.photo; write(db); }
      photos = (photos || []).filter((p) => p.id !== id);
    },
  };
}
