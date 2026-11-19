import { getBackend, friendly, MAX_COFFEES } from './backend.js';
import { LANGUAGES, setLanguage, language, t, formatDate, formatTime } from './i18n.js';
import { snow, crumble, polaroids, bigWin, reduceMotion } from './fx.js';
import { createWheel } from './wheel.js';
import { openCamera, capture, fileToPhoto } from './camera.js';

const C = window.RSVP_CONFIG;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const tz = C.timeZone;
const start = new Date(C.start);
const end = new Date(C.end);
const LANG_KEY = 'zd-lang';

// ── State ────────────────────────────────────────────────
const S = {
  user: null,
  rsvp: null,           // { attending, name, department, plusOne, message, language }
  spin: null,           // { prize, song }
  coffees: 0,
  againsUsed: 0,
  wantsToStart: false,  // pressed "Log in" (so go straight to the questions)
  started: false,
};
let backend;

// ── Small helpers ────────────────────────────────────────
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((k) => k != null && e.append(k));
  return e;
}
function setError(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }
function busy(btn, on) { if (!btn) return; btn.disabled = on; btn.classList.toggle('loading', on); }
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}
function guessName(email) {
  return email.split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// ── Screens ──────────────────────────────────────────────
const STEPS = ['info', 'attend', 'details', 'message', 'colleague', 'wheel', 'done'];
const BACK = {
  attend: 'info', details: 'attend', colleague: 'message',
  message: () => (S.rsvp && S.rsvp.attending === 'No' ? 'attend' : 'details'),
};
let current = 'loading';
let beforeLang = 'info';

function go(name) {
  if (current === 'wheel' && name !== 'wheel') stopCamera();
  current = name;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  const idx = STEPS.indexOf(name);
  $$('#progress li').forEach((li, i) => {
    li.classList.toggle('on', i === idx);
    li.classList.toggle('done', idx >= 0 && i < idx);
  });
  $('#progress').style.visibility = idx >= 0 ? 'visible' : 'hidden';
  $('#back').hidden = !BACK[name];
  $('#lang-btn').hidden = name === 'lang' || name === 'loading';
  if (ENTER[name]) ENTER[name]();
  window.scrollTo(0, 0);
}

$('#progress').append(...STEPS.map(() => h('li')));
$('#back').addEventListener('click', () => {
  const b = BACK[current];
  if (b) go(typeof b === 'function' ? b() : b);
});

// ── 1. Language ──────────────────────────────────────────
function renderLangGrid() {
  const grid = $('#lang-grid');
  grid.replaceChildren(...LANGUAGES.map(([code, label]) => h('button', {
    class: 'lang' + (code === 'en' ? ' en' : '') + (code === language() ? ' on' : ''),
    type: 'button', lang: code, onclick: () => chooseLanguage(code),
  }, label)));
}

async function chooseLanguage(code) {
  await setLanguage(code);
  lsSet(LANG_KEY, code);
  renderTexts();
  renderLangGrid();
  toast(t('lang.applied'));
  go(S.user && beforeLang !== 'lang' ? beforeLang : 'info');
}

$('#lang-btn').addEventListener('click', () => { beforeLang = current; go('lang'); });

// ── 2. Info ──────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
(function tick() {
  const ms = start - new Date();
  if (ms <= 0) { const c = $('#countdown'); c.className = 'countdown live'; c.textContent = '🎉🎄🎉'; return; }
  const s = Math.floor(ms / 1000);
  $('#cd-d').textContent = Math.floor(s / 86400) + 'd';
  $('#cd-h').textContent = pad(Math.floor(s / 3600) % 24) + 'h';
  $('#cd-m').textContent = pad(Math.floor(s / 60) % 60) + 'm';
  $('#cd-s').textContent = pad(s % 60) + 's';
  setTimeout(tick, 1000);
})();

function renderInfo() {
  $('#fact-when').textContent = `${formatDate(start, true, tz)} · ${formatTime(start, tz)}–${formatTime(end, tz)}`;
  const where = $('#fact-where');
  where.replaceChildren(C.venueUrl ? h('a', { href: C.venueUrl, target: '_blank', rel: 'noopener' }, C.venue) : C.venue);
  $('#fact-price').textContent = t('info.priceValue', { amount: C.price });
  $('#deadline').textContent = C.rsvpDeadline ? t('info.deadline', { date: formatDate(new Date(C.rsvpDeadline + 'T12:00:00Z'), false, tz) }) : '';
  const contact = $('#contact');
  const text = t('info.contact', { name: C.contactName });
  contact.replaceChildren(C.contactEmail ? h('a', { href: 'mailto:' + C.contactEmail }, text) : text);
  $('#login').hidden = !!S.user;
  $('#info-next').hidden = !S.user;
  $('#login-note').textContent = S.user ? S.user.email : t('info.loginNote', { domain: C.allowedDomain });
}

$('#login').addEventListener('click', async () => {
  const btn = $('#login');
  setError($('#auth-error'), '');
  S.wantsToStart = true;
  busy(btn, true);
  try { await backend.signIn(); } catch (e) { setError($('#auth-error'), friendly(e)); S.wantsToStart = false; }
  finally { busy(btn, false); }
});
$('#info-next').addEventListener('click', () => go(nextAfterLogin()));

function nextAfterLogin() {
  if (S.rsvp && S.rsvp.attending && S.spin) return 'done';
  if (S.rsvp && S.rsvp.attending) return 'wheel';
  return 'attend';
}

// ── 3. Attend ────────────────────────────────────────────
async function saveRsvp(errEl, btn) {
  setError(errEl, '');
  busy(btn, true);
  try {
    S.rsvp.language = language();
    await backend.saveRsvp(S.user, S.rsvp);
    refreshHeadcount();
    return true;
  } catch (e) {
    setError(errEl, friendly(e) || t('common.error'));
    return false;
  } finally {
    busy(btn, false);
  }
}

$$('[data-attend]').forEach((b) => b.addEventListener('click', async () => {
  S.rsvp.attending = b.dataset.attend;
  markAttend();
  if (await saveRsvp($('#attend-error'))) go('details');
}));

$('#no-btn').addEventListener('click', async () => {
  const btn = $('#no-btn');
  btn.disabled = true;
  await crumble(btn);
  $('#crumbled').hidden = false;
  $('#really-no').hidden = false;
  $('#really-no').focus();
});

$('#really-no').addEventListener('click', async () => {
  S.rsvp.attending = 'No';
  S.rsvp.plusOne = false;
  if (await saveRsvp($('#attend-error'), $('#really-no'))) go('message');
});

function markAttend() {
  $$('[data-attend]').forEach((b) => b.classList.toggle('picked', b.dataset.attend === S.rsvp.attending));
}

// ── 3b. Details ──────────────────────────────────────────
$('#plus-one').addEventListener('change', (e) => { $('#plus-one-note').hidden = !e.target.checked; });
$('#details-next').addEventListener('click', async () => {
  S.rsvp.department = $('#team').value.trim();
  S.rsvp.plusOne = $('#plus-one').checked;
  if (await saveRsvp($('#details-error'), $('#details-next'))) go('message');
});

// ── 4. Message ───────────────────────────────────────────
$('#message-next').addEventListener('click', async () => {
  S.rsvp.message = $('#message').value.trim();
  if (await saveRsvp($('#message-error'), $('#message-next'))) go(S.spin ? 'done' : 'colleague');
});

// ── 5. Favourite colleague (never stored) ────────────────
const FAVOURITE = 'Michael Bauer';
$('#colleague').addEventListener('input', (e) => {
  const n = Math.min(e.target.value.length, FAVOURITE.length);
  e.target.value = FAVOURITE.slice(0, n);
  const done = n === FAVOURITE.length;
  $('#colleague-done').hidden = !done;
  $('#colleague-next').disabled = !done;
});
$('#colleague-next').addEventListener('click', () => go('wheel'));

// ── 6. Wheel ─────────────────────────────────────────────
// Order around the wheel: unwinnable and winnable slots alternate.
const SEGMENTS = ['freeEntry', 'song', 'microwave', 'bigwin', 'jira', 'photo', 'cash', 'coffee', 'again', 'youtube'];
const PRIZE_EMOJI = { song: '🎵', photo: '📸', coffee: '☕', bigwin: '💰', youtube: '📺' };
const wheel = createWheel($('#wheel'), SEGMENTS, { special: { bigwin: 'gold' } });

function decide(noCoffee) {
  const w = {
    song: 22, photo: 22, bigwin: 20, youtube: 18,
    again: S.againsUsed < 2 ? 14 : 0,
    coffee: !noCoffee && S.coffees < MAX_COFFEES ? 9 : 0,
  };
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) { if ((r -= v) < 0) return k; }
  return 'bigwin';
}

async function claim(prize) {
  try {
    await backend.saveSpin(S.user, prize);
    return prize;
  } catch (e) {
    if (e && e.code === 'coffee-gone') {
      S.coffees = MAX_COFFEES;
      let p;
      do { p = decide(true); } while (p === 'again');
      await backend.saveSpin(S.user, p);
      return p;
    }
    throw e;
  }
}

$('#spin').addEventListener('click', async () => {
  const btn = $('#spin');
  btn.disabled = true;
  setError($('#wheel-error'), '');
  $('#result').hidden = true;
  let prize = decide();
  if (prize !== 'again') {
    try { prize = await claim(prize); } catch (e) {
      setError($('#wheel-error'), friendly(e) || t('common.error'));
      btn.disabled = false;
      return;
    }
    S.spin = { prize, song: '' };
  }
  await wheel.spinTo(SEGMENTS.indexOf(prize), {
    nearMiss: 'microwave', pointer: $('.pointer'), reduced: reduceMotion,
    onNearMiss: () => toast(t('wheel.soClose')),
  });
  if (prize === 'again') {
    S.againsUsed++;
    toast(t('again.title'));
    btn.disabled = false;
    return;
  }
  showResult(prize, true);
});

let stopCam = null;
function stopCamera() { if (stopCam) { stopCam(); stopCam = null; } }

async function showResult(prize, fresh) {
  if (prize === 'bigwin' && fresh) await bigWin($('#bigwin'), $('#bigwin-amount'), $('#coins'), t('bigwin.title'));
  const box = $('#result');
  const cont = () => h('button', { class: 'btn gold', type: 'button', onclick: () => go('done') }, t('common.continue'));
  const titles = { song: 'song.title', photo: 'photo.title', coffee: 'coffee.title', bigwin: 'bigwin.title', youtube: 'youtube.title' };
  const parts = [
    !fresh ? h('p', {}, t('wheel.already')) : null,
    h('div', { class: 'big' }, PRIZE_EMOJI[prize] || '🎁'),
    h('h2', {}, t(titles[prize])),
  ];

  if (prize === 'song') {
    const input = h('input', { maxlength: 200, placeholder: t('song.ph'), value: (S.spin && S.spin.song) || '' });
    const err = h('p', { class: 'error', role: 'alert', hidden: true });
    const save = h('button', { class: 'btn gold', type: 'button' }, t('song.save'));
    save.addEventListener('click', async () => {
      const song = input.value.trim();
      if (!song) { input.focus(); return; }
      busy(save, true);
      try { await backend.saveSong(S.user, song); S.spin.song = song; go('done'); }
      catch (e) { setError(err, friendly(e) || t('common.error')); }
      finally { busy(save, false); }
    });
    parts.push(h('p', {}, t('song.q')), input, err, save);
  } else if (prize === 'photo') {
    parts.push(h('p', {}, t('photo.text')), photoBooth(cont));
  } else if (prize === 'coffee') {
    parts.push(h('p', {}, t('coffee.text')), cont());
  } else if (prize === 'bigwin') {
    parts.push(h('p', {}, t('bigwin.text')), cont());
  } else if (prize === 'youtube') {
    // The video only opens from the final screen, once the RSVP is complete.
    parts.push(h('p', {}, t('youtube.text')), cont());
  }
  box.replaceChildren(...parts.filter(Boolean));
  box.hidden = false;
  box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
}

function photoBooth(cont) {
  const wrap = h('div');
  const err = h('p', { class: 'error', role: 'alert', hidden: true });
  const frame = h('div', { class: 'cam' });
  const video = h('video', { autoplay: true, playsinline: true, muted: true });
  const actions = h('div', { class: 'cam-actions' });
  const file = h('input', { type: 'file', accept: 'image/*', capture: 'user' });
  const pick = h('label', { class: 'file-pick' }, t('photo.pick'), file);
  let shot = null;

  function live() {
    shot = null;
    frame.replaceChildren(video);
    const take = h('button', { class: 'btn gold', type: 'button' }, t('photo.take'));
    take.addEventListener('click', () => preview(capture(video, true)));
    actions.replaceChildren(take);
  }
  function preview(dataUrl) {
    shot = dataUrl;
    stopCamera();
    frame.replaceChildren(h('img', { src: dataUrl, alt: '' }));
    const retake = h('button', { class: 'btn ghost', type: 'button' }, t('photo.retake'));
    const use = h('button', { class: 'btn gold', type: 'button' }, t('photo.use'));
    retake.addEventListener('click', openCam);
    use.addEventListener('click', async () => {
      busy(use, true);
      try {
        await backend.savePhoto(S.user, shot, S.rsvp.name);
        loadPhotos();
        go('done');
      } catch (e) { setError(err, friendly(e) || t('common.error')); }
      finally { busy(use, false); }
    });
    actions.replaceChildren(retake, use);
  }
  async function openCam() {
    setError(err, '');
    try { stopCamera(); stopCam = await openCamera(video); live(); }
    catch (e) { frame.replaceChildren(); actions.replaceChildren(); setError(err, t('photo.noCamera')); }
  }
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    try { preview(await fileToPhoto(file.files[0])); } catch (e) { setError(err, t('common.error')); }
  });
  wrap.append(frame, actions, err, pick, h('button', { class: 'linkish', type: 'button', onclick: () => go('done') }, t('common.skip')));
  openCam();
  return wrap;
}

/** A genuinely random video: searches for camera-default filenames like "IMG_4821". */
async function randomVideo() {
  const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const q = ['IMG_', 'MVI_', 'DSC_', 'VID_'][Math.floor(Math.random() * 4)] + num;
  if (C.youtubeApiKey) {
    try {
      const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({
        part: 'id', type: 'video', maxResults: '50', safeSearch: 'strict', q, key: C.youtubeApiKey,
      }));
      const items = ((await r.json()).items || []).filter((i) => i.id && i.id.videoId);
      if (items.length) return 'https://www.youtube.com/watch?v=' + items[Math.floor(Math.random() * items.length)].id.videoId;
    } catch (e) { /* fall through to a search page */ }
  }
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
}

// ── 7. Done ──────────────────────────────────────────────
const gcal = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
$('#add-cal').href = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
  action: 'TEMPLATE', text: `${C.title} · ZD Christmas 2026`, dates: gcal(start) + '/' + gcal(end), details: C.tagline, location: C.venue,
});

function renderDone() {
  if (!S.rsvp) return;
  const a = S.rsvp.attending;
  $('#done-text').textContent = a === 'Yes' ? t('done.yes', { date: formatDate(start, false, tz) }) : a === 'Maybe' ? t('done.maybe') : t('done.no');
  const ATT = { Yes: 'attend.yes', Maybe: 'attend.maybe', No: 'attend.no' };
  const rows = [[t('done.answer'), t(ATT[a] || 'attend.maybe')]];
  if (a !== 'No') {
    if (S.rsvp.department) rows.push([t('done.team'), S.rsvp.department]);
    rows.push([t('done.plusOne'), S.rsvp.plusOne ? t('common.yes') : t('common.no')]);
  }
  if (S.spin) rows.push([t('done.prize'), `${PRIZE_EMOJI[S.spin.prize] || ''} ${t('prize.' + S.spin.prize)}${S.spin.song ? ' · ' + S.spin.song : ''}`]);
  $('#summary').replaceChildren(...rows.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))));
  $('#add-cal').hidden = a === 'No';
  $('#yt-go').hidden = !(S.spin && S.spin.prize === 'youtube');
}

// Opens in a new tab so the RSVP page stays where it is.
$('#yt-go').addEventListener('click', async () => {
  const btn = $('#yt-go');
  const win = window.open('about:blank', '_blank');
  busy(btn, true);
  const url = await randomVideo();
  busy(btn, false);
  if (win) { win.opener = null; win.location.href = url; } else { location.href = url; }
});

$('#change').addEventListener('click', () => go('attend'));
$('#sign-out').addEventListener('click', () => backend.signOut());

// ── Screen entry hooks ───────────────────────────────────
const ENTER = {
  info: renderInfo,
  attend() {
    const no = $('#no-btn');
    no.style.visibility = '';
    no.disabled = false;
    $('#crumbled').hidden = true;
    $('#really-no').hidden = true;
    setError($('#attend-error'), '');
    markAttend();
  },
  details() {
    $('#team').value = S.rsvp.department || '';
    $('#plus-one').checked = !!S.rsvp.plusOne;
    $('#plus-one-note').hidden = !S.rsvp.plusOne;
  },
  message() { $('#message').value = S.rsvp.message || ''; },
  colleague() {
    $('#colleague').value = '';
    $('#colleague-done').hidden = true;
    $('#colleague-next').disabled = true;
  },
  wheel() {
    wheel.render((id) => t('prize.' + id));
    setError($('#wheel-error'), '');
    $('#result').hidden = true;
    $('#spin').disabled = !!S.spin;
    if (S.spin) { wheel.show(SEGMENTS.indexOf(S.spin.prize)); showResult(S.spin.prize, false); }
  },
  done: renderDone,
};

/** Re-renders everything that contains translated text built in JS. */
function renderTexts() {
  renderInfo();
  if (current === 'wheel') ENTER.wheel();
  renderDone();
  refreshHeadcount();
}

// ── Headcount + polaroids ────────────────────────────────
function refreshHeadcount() {
  const els = [$('#headcount'), $('#done-headcount')];
  if (!S.user || !C.showHeadcount || !backend) { els.forEach((e) => { e.hidden = true; }); return; }
  backend.headcount().then((n) => {
    els.forEach((e) => { e.textContent = t('info.headcount', { n }); e.hidden = !n; });
  }).catch(() => {});
}

function loadPhotos() {
  if (!S.user) { $('#polaroids').replaceChildren(); return; }
  backend.listPhotos().then((list) => polaroids($('#polaroids'), list)).catch(() => {});
}

// ── Sign-in state ────────────────────────────────────────
async function onUser(u, err) {
  S.user = u;
  if (!u) {
    S.rsvp = null; S.spin = null;
    loadPhotos();
    refreshHeadcount();
    setError($('#auth-error'), err === 'domain' ? t('info.wrongDomain', { domain: C.allowedDomain }) : '');
    go(!S.started && !lsGet(LANG_KEY) ? 'lang' : 'info');
    S.started = true;
    return;
  }
  go('loading');
  try {
    const data = await backend.load(u);
    S.rsvp = data.rsvp || { attending: '', name: u.name || guessName(u.email), department: '', plusOne: false, message: '', language: language() };
    if (!S.rsvp.name) S.rsvp.name = u.name || guessName(u.email);
    S.spin = data.spin;
    S.coffees = data.coffees;
    if (!lsGet(LANG_KEY) && data.rsvp && data.rsvp.language && data.rsvp.language !== language()) {
      await setLanguage(data.rsvp.language);
      renderLangGrid();
    }
    loadPhotos();
    refreshHeadcount();
    const next = S.wantsToStart ? nextAfterLogin() : (S.rsvp.attending ? nextAfterLogin() : 'info');
    S.wantsToStart = false;
    S.started = true;
    go(next);
  } catch (e) {
    setError($('#auth-error'), friendly(e) || t('common.error'));
    go('info');
  }
}

// ── Boot ─────────────────────────────────────────────────
(async function boot() {
  snow($('#snow'));
  go('loading');
  await setLanguage(lsGet(LANG_KEY) || 'en');
  renderLangGrid();
  renderInfo();
  try {
    backend = await getBackend(C);
  } catch (e) {
    go('info');
    setError($('#auth-error'), 'The page could not start: ' + (e.message || e));
    $('#login').disabled = true;
    return;
  }
  $('#demo-banner').hidden = !backend.demo;
  backend.onUser(onUser);
})();
