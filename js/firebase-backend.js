// Real backend: Google sign-in + Cloud Firestore.
// Security is enforced server-side by firestore.rules; the checks here are only for nicer messages.
import { heads, pick, MAX_COFFEES } from './backend.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function create(C) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js'),
  ]);

  const app = initializeApp(C.firebase);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const domain = C.allowedDomain.toLowerCase();

  const allowed = (u) => u && u.emailVerified && (u.email || '').toLowerCase().endsWith('@' + domain);
  const toDate = (t) => (t && t.toDate ? t.toDate() : null);
  const ref = (col, id) => F.doc(db, col, id);
  const coffeeRef = ref('prizes', 'coffee');

  async function coffeeCount() {
    const s = await F.getDoc(coffeeRef);
    return s.exists() ? s.data().count || 0 : 0;
  }

  return {
    demo: false,

    /** cb(user | null, errorCode?) — errorCode 'domain' when a non-company account signed in. */
    onUser(cb) {
      return A.onAuthStateChanged(auth, async (u) => {
        if (u && !allowed(u)) { await A.signOut(auth); cb(null, 'domain'); return; }
        cb(u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null);
      });
    },

    async signIn() {
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({ hd: domain, prompt: 'select_account' });
      await A.signInWithPopup(auth, provider);
    },

    signOut: () => A.signOut(auth),

    /** Everything the RSVP flow needs after sign-in, in one go. */
    async load(user) {
      const [r, s, coffees] = await Promise.all([
        F.getDoc(ref('rsvps', user.uid)),
        F.getDoc(ref('spins', user.uid)),
        coffeeCount().catch(() => MAX_COFFEES),
      ]);
      return {
        rsvp: r.exists() ? pick(r.data()) : null,
        spin: s.exists() ? { prize: s.data().prize, song: s.data().song || '' } : null,
        coffees,
      };
    },

    /** Saves the reply and the anonymous headcount entry in one atomic write. */
    async saveRsvp(user, data) {
      const rRef = ref('rsvps', user.uid);
      const existing = await F.getDoc(rRef);
      const batch = F.writeBatch(db);
      batch.set(rRef, {
        ...pick(data),
        email: user.email,
        createdAt: existing.exists() ? existing.data().createdAt : F.serverTimestamp(),
        updatedAt: F.serverTimestamp(),
      });
      batch.set(ref('counts', user.uid), { n: heads(data) });
      await batch.commit();
      return { updated: existing.exists() };
    },

    async headcount() {
      const snap = await F.getAggregateFromServer(F.collection(db, 'counts'), { total: F.sum('n') });
      return snap.data().total || 0;
    },

    coffeeCount,

    /**
     * Stores the one-and-only wheel result. Coffee goes through a transaction with the
     * shared counter; throws {code:'coffee-gone'} if the 3 coffees ran out meanwhile.
     */
    async saveSpin(user, prize) {
      const sRef = ref('spins', user.uid);
      const spin = { prize, song: '', at: F.serverTimestamp() };
      if (prize !== 'coffee') { await F.setDoc(sRef, spin); return; }
      await F.runTransaction(db, async (tx) => {
        const c = await tx.get(coffeeRef);
        const count = c.exists() ? c.data().count || 0 : 0;
        if (count >= MAX_COFFEES) throw Object.assign(new Error('No coffees left'), { code: 'coffee-gone' });
        tx.set(sRef, spin);
        tx.set(coffeeRef, { count: count + 1 });
      });
    },

    saveSong: (user, song) => F.updateDoc(ref('spins', user.uid), { song }),

    savePhoto: (user, data, name) => F.setDoc(ref('photos', user.uid), { data, name, at: F.serverTimestamp() }),

    async listPhotos(max = 40) {
      const qs = await F.getDocs(F.query(F.collection(db, 'photos'), F.orderBy('at', 'desc'), F.limit(max)));
      return qs.docs.map((d) => ({ id: d.id, data: d.data().data, name: d.data().name || '' }));
    },

    // ── Organisers only (enforced by the rules) ──
    async listAll() {
      const [rs, ss] = await Promise.all([
        F.getDocs(F.query(F.collection(db, 'rsvps'), F.orderBy('updatedAt', 'desc'))),
        F.getDocs(F.collection(db, 'spins')),
      ]);
      const spins = {};
      ss.docs.forEach((d) => { spins[d.id] = d.data(); });
      return rs.docs.map((d) => {
        const r = d.data();
        const s = spins[d.id] || {};
        return {
          id: d.id, ...pick(r), email: r.email,
          prize: s.prize || '', song: s.song || '',
          createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt),
        };
      });
    },

    deletePhoto: (id) => F.deleteDoc(ref('photos', id)),

    /** Organiser correction of a reply; the headcount entry is kept in step. */
    async updateReply(id, data) {
      const d = pick(data);
      const batch = F.writeBatch(db);
      batch.update(ref('rsvps', id), {
        attending: d.attending, name: d.name, department: d.department,
        plusOne: d.plusOne, message: d.message, updatedAt: F.serverTimestamp(),
      });
      batch.set(ref('counts', id), { n: heads(d) });
      await batch.commit();
    },

    updateSong: (id, song) => F.updateDoc(ref('spins', id), { song }),

    /** Lets the person spin again: removes their spin and photo, and hands back a won coffee. */
    resetSpin: (id) => removeSpin(id, false),

    /** Removes everything stored for this person. */
    deleteReply: (id) => removeSpin(id, true),
  };

  async function removeSpin(id, everything) {
    await F.runTransaction(db, async (tx) => {
      // Firestore transactions need every read before any write.
      const s = await tx.get(ref('spins', id));
      const coffee = s.exists() && s.data().prize === 'coffee';
      const c = coffee ? await tx.get(coffeeRef) : null;
      if (c && c.exists()) tx.update(coffeeRef, { count: Math.max(0, (c.data().count || 0) - 1) });
      if (s.exists()) tx.delete(ref('spins', id));
      tx.delete(ref('photos', id));
      if (everything) { tx.delete(ref('rsvps', id)); tx.delete(ref('counts', id)); }
    });
  }
}
