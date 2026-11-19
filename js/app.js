import { getBackend, friendly, pick } from './backend.js';

const C = window.RSVP_CONFIG;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

// ── Event details ────────────────────────────────────────
const start = new Date(C.start);
const end = new Date(C.end);
const tz = C.timeZone || undefined;

document.title = C.title + ' · RSVP';
$('#event-title').textContent = C.title;
$('#event-tagline').textContent = C.tagline;
$('#event-date').textContent = start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
$('#event-time').textContent = [start, end].map((d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz })).join(' – ');
if (C.venueUrl) {
  const a = document.createElement('a');
  a.href = C.venueUrl;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = C.venue;
  $('#event-venue').replaceChildren(a);
} else {
  $('#event-venue').textContent = C.venue;
}
if (C.rsvpDeadline) {
  const dl = $('#deadline-note');
  dl.textContent = 'Please reply by ' + new Date(C.rsvpDeadline + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: tz }) + '.';
  dl.hidden = false;
}
const contact = $('#contact');
contact.textContent = C.contactName;
if (C.contactEmail) contact.href = 'mailto:' + C.contactEmail;
if (!C.allowPlusOne) $('#plusone-wrap').remove();
$('#auth-note').textContent = `Sign in with your @${C.allowedDomain} Google account to reply. We only use it to know who's coming.`;

// ── Countdown ────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
(function tick() {
  const ms = start - new Date();
  if (ms <= 0) { $('#countdown').innerHTML = '<p class="live">🎉 It\'s party time!</p>'; return; }
  const s = Math.floor(ms / 1000);
  $('#cd-d').textContent = Math.floor(s / 86400);
  $('#cd-h').textContent = pad(Math.floor(s / 3600) % 24);
  $('#cd-m').textContent = pad(Math.floor(s / 60) % 60);
  $('#cd-s').textContent = pad(s % 60);
  setTimeout(tick, 1000);
})();

// ── Google Calendar link ─────────────────────────────────
const gcal = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
$('#add-cal').href = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
  action: 'TEMPLATE', text: C.title, dates: gcal(start) + '/' + gcal(end), details: C.tagline, location: C.venue,
});

// ── Screens ──────────────────────────────────────────────
const cards = ['#loading-card', '#auth-card', '#form-card', '#thanks'];
function show(id) {
  cards.forEach((c) => { $(c).hidden = c !== id; });
  if (id === '#thanks') $('#thanks').focus();
}
function loading(text) { $('#loading-text').textContent = text; show('#loading-card'); }
function setError(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }
function busy(btn, on) { btn.disabled = on; btn.classList.toggle('loading', on); }

// ── Form ─────────────────────────────────────────────────
const form = $('#rsvp');
const f = form.elements;

function sync() {
  const a = f.attending.value;
  $('.when-coming', form).hidden = !(a === 'Yes' || a === 'Maybe');
  $('.plusone-name', form).hidden = !(f.plusOne && f.plusOne.checked);
}
form.addEventListener('change', sync);

function fill(d) {
  ['name', 'department', 'plusOneName', 'dietary', 'message'].forEach((k) => { f[k].value = d[k] || ''; });
  if (f.plusOne) f.plusOne.checked = !!d.plusOne;
  const r = form.querySelector(`input[name="attending"][value="${d.attending}"]`);
  if (r) r.checked = true;
  sync();
}

function collect() {
  const a = f.attending.value;
  const coming = a === 'Yes' || a === 'Maybe';
  const plusOne = coming && !!(f.plusOne && f.plusOne.checked);
  return pick({
    attending: a,
    name: f.name.value.trim(),
    department: f.department.value.trim(),
    plusOne,
    plusOneName: plusOne ? f.plusOneName.value.trim() : '',
    dietary: coming ? f.dietary.value.trim() : '',
    message: f.message.value.trim(),
  });
}

// ── Thank-you ────────────────────────────────────────────
const COPY = {
  Yes: ['🎉', 'See you there!', 'Your spot is saved. We can\'t wait to celebrate with you.'],
  Maybe: ['🤞', 'Thanks for letting us know', 'We\'ve noted you as a maybe. Please update your answer once you know.'],
  No: ['🎄', 'We\'ll miss you', 'Thanks for replying. Have a wonderful holiday season!'],
};
const LABEL = { Yes: 'Count me in', Maybe: 'Maybe', No: 'Can\'t make it' };

function thanks(d, mode) {
  const [emoji, title, text] = COPY[d.attending];
  $('#thanks-emoji').textContent = emoji;
  $('#thanks-title').textContent = mode === 'existing' ? 'You\'ve already replied' : (mode === 'updated' ? 'Updated. ' : '') + title;
  $('#thanks-text').textContent = mode === 'existing'
    ? `Your answer: ${LABEL[d.attending]}${d.plusOne ? ' (+1)' : ''}. You can change it below.`
    : text;
  $('#add-cal').hidden = d.attending === 'No';
  show('#thanks');
  if (d.attending === 'Yes' && mode !== 'existing') burst();
}

// ── Wire up the backend ──────────────────────────────────
let backend;
let user = null;

function headcount() {
  if (!C.showHeadcount || !user) return;
  backend.headcount().then((n) => {
    const el = $('#headcount');
    el.hidden = !n;
    el.textContent = n === 1 ? '1 person is coming so far' : `${n} people are coming so far`;
  }).catch(() => {});
}

function guessName(email) {
  return email.split('@')[0].split(/[._-]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function onUser(u, err) {
  user = u;
  $('#headcount').hidden = true;
  if (!u) {
    setError($('#auth-error'), err);
    show('#auth-card');
    return;
  }
  $('#me-email').textContent = u.email;
  loading('Loading your reply…');
  headcount();
  try {
    const existing = await backend.load(u);
    form.reset();
    if (existing) { fill(existing); thanks(existing, 'existing'); }
    else { f.name.value = u.name || guessName(u.email); sync(); show('#form-card'); }
  } catch (e) {
    setError($('#auth-error'), friendly(e) || 'Could not load your reply.');
    show('#auth-card');
  }
}

$('#sign-in').addEventListener('click', async () => {
  const btn = $('#sign-in');
  setError($('#auth-error'), '');
  busy(btn, true);
  try { await backend.signIn(); }
  catch (e) { setError($('#auth-error'), friendly(e)); }
  finally { busy(btn, false); }
});

$$('.sign-out').forEach((b) => b.addEventListener('click', () => backend.signOut()));
$('#again').addEventListener('click', () => { show('#form-card'); f.name.focus(); });

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const errEl = $('#error');
  setError(errEl, '');
  const data = collect();
  if (!data.attending) return setError(errEl, 'Please let us know if you can make it.');
  if (!data.name) { f.name.focus(); return setError(errEl, 'Please enter your name.'); }
  if (data.plusOne && !data.plusOneName) { f.plusOneName.focus(); return setError(errEl, 'Please add your plus one\'s name.'); }

  const btn = $('#submit');
  busy(btn, true);
  try {
    const res = await backend.save(user, data);
    thanks(data, res.updated ? 'updated' : 'new');
    headcount();
  } catch (e) {
    setError(errEl, friendly(e) || 'Could not save your reply. Please try again.');
  } finally {
    busy(btn, false);
  }
});

getBackend(C)
  .then((b) => {
    backend = b;
    $('#demo-banner').hidden = !b.demo;
    b.onUser(onUser);
  })
  .catch((e) => {
    setError($('#auth-error'), 'The page could not start: ' + (e.message || e));
    show('#auth-card');
    $('#sign-in').disabled = true;
  });

// ── Snow + confetti ──────────────────────────────────────
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cv = $('#snow');
const ctx = cv.getContext('2d');
const flakes = [];
let bits = [];
function size() { cv.width = innerWidth; cv.height = innerHeight; }
size();
addEventListener('resize', size);
const count = reduce ? 0 : Math.min(120, Math.floor(innerWidth / 10));
for (let i = 0; i < count; i++) {
  flakes.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    r: Math.random() * 2.2 + 0.6, v: Math.random() * 0.6 + 0.3, w: Math.random() * Math.PI * 2 });
}
function burst() {
  if (reduce) return;
  const cols = ['#e63946', '#f1c453', '#2a9d8f', '#ffffff', '#8ecae6'];
  for (let i = 0; i < 160; i++) {
    bits.push({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 3, s: Math.random() * 6 + 4, c: cols[i % cols.length],
      a: Math.random() * Math.PI, life: 160 });
  }
}
(function frame() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  flakes.forEach((p) => {
    p.y += p.v; p.w += 0.01; p.x += Math.sin(p.w) * 0.4;
    if (p.y > cv.height) { p.y = -5; p.x = Math.random() * cv.width; }
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  });
  bits = bits.filter((b) => b.life-- > 0);
  bits.forEach((b) => {
    b.vy += 0.3; b.x += b.vx; b.y += b.vy; b.vx *= 0.99; b.a += 0.2;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.fillStyle = b.c; ctx.globalAlpha = Math.min(1, b.life / 40);
    ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore();
  });
  requestAnimationFrame(frame);
})();
