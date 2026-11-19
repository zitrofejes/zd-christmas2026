// Real backend: Google sign-in + Cloud Firestore.
// Security is enforced server-side by firestore.rules; the checks here are only for nicer messages.
import { heads, pick } from './backend.js';

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

  return {
    demo: false,

    /** cb(user | null, errorMessage?) */
    onUser(cb) {
      return A.onAuthStateChanged(auth, async (u) => {
        if (u && !allowed(u)) {
          await A.signOut(auth);
          cb(null, `Please sign in with your @${domain} Google account.`);
          return;
        }
        cb(u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null);
      });
    },

    async signIn() {
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({ hd: domain, prompt: 'select_account' });
      await A.signInWithPopup(auth, provider);
    },

    signOut: () => A.signOut(auth),

    async load(user) {
      const snap = await F.getDoc(F.doc(db, 'rsvps', user.uid));
      return snap.exists() ? pick(snap.data()) : null;
    },

    /** Saves the reply and the anonymous headcount entry in one atomic write. */
    async save(user, data) {
      const ref = F.doc(db, 'rsvps', user.uid);
      const existing = await F.getDoc(ref);
      const batch = F.writeBatch(db);
      batch.set(ref, {
        ...pick(data),
        email: user.email,
        createdAt: existing.exists() ? existing.data().createdAt : F.serverTimestamp(),
        updatedAt: F.serverTimestamp(),
      });
      batch.set(F.doc(db, 'counts', user.uid), { n: heads(data) });
      await batch.commit();
      return { updated: existing.exists() };
    },

    async headcount() {
      const snap = await F.getAggregateFromServer(F.collection(db, 'counts'), { total: F.sum('n') });
      return snap.data().total || 0;
    },

    /** Organisers only (enforced by the rules). */
    async listAll() {
      const qs = await F.getDocs(F.query(F.collection(db, 'rsvps'), F.orderBy('updatedAt', 'desc')));
      return qs.docs.map((d) => {
        const r = d.data();
        return { ...pick(r), email: r.email, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
      });
    },
  };
}
