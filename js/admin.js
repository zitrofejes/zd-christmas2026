// Organiser view. Firestore rules only let accounts listed in organisers/{email} read the replies;
// everyone else gets "permission-denied" here.
import { getBackend, friendly, heads } from './backend.js';

const C = window.RSVP_CONFIG;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

$('#event-title').textContent = C.title;

const cards = ['#loading-card', '#auth-card', '#data-card'];
const show = (id) => cards.forEach((c) => { $(c).hidden = c !== id; });
const setError = (msg) => { const e = $('#auth-error'); e.textContent = msg || ''; e.hidden = !msg; };

let backend;
let rows = [];
let filter = '';

const fmt = (d) => (d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: C.timeZone }) : '');
const LABEL = { Yes: 'Coming', Maybe: 'Maybe', No: 'Not coming' };

function stats() {
  const by = (a) => rows.filter((r) => r.attending === a);
  const yes = by('Yes');
  const items = [
    [rows.length, 'replies'],
    [yes.reduce((n, r) => n + heads(r), 0), 'people coming (incl. +1)'],
    [yes.length, 'colleagues coming'],
    [yes.filter((r) => r.plusOne).length, 'plus ones'],
    [by('Maybe').length, 'maybe'],
    [by('No').length, 'not coming'],
    [rows.filter((r) => r.attending !== 'No' && r.dietary).length, 'dietary notes'],
  ];
  const box = $('#stats');
  box.replaceChildren(...items.map(([n, label]) => {
    const d = document.createElement('div');
    d.className = 'stat';
    const b = document.createElement('b'); b.textContent = n;
    const s = document.createElement('span'); s.textContent = label;
    d.append(b, s);
    return d;
  }));
}

function visible() {
  const q = $('#search').value.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter === 'dietary' ? !(r.dietary && r.attending !== 'No') : filter && r.attending !== filter) return false;
    if (!q) return true;
    return [r.name, r.email, r.department, r.plusOneName, r.dietary, r.message].join(' ').toLowerCase().includes(q);
  });
}

function td(text, cls) {
  const c = document.createElement('td');
  if (cls) c.className = cls;
  c.textContent = text == null ? '' : text; // textContent: replies can never inject HTML
  return c;
}

function render() {
  stats();
  const list = visible();
  const body = $('#rows');
  if (!list.length) {
    const tr = document.createElement('tr');
    const c = td(rows.length ? 'No replies match.' : 'No replies yet.', 'empty');
    c.colSpan = 8;
    tr.append(c);
    body.replaceChildren(tr);
    return;
  }
  body.replaceChildren(...list.map((r) => {
    const tr = document.createElement('tr');
    const ans = td('');
    const pill = document.createElement('span');
    pill.className = 'pill ' + r.attending;
    pill.textContent = LABEL[r.attending] || r.attending;
    ans.append(pill);
    tr.append(
      td(r.name), td(r.email), td(r.department), ans,
      td(r.plusOne ? (r.plusOneName || 'Yes') : ''),
      td(r.dietary), td(r.message), td(fmt(r.updatedAt), 'nowrap'),
    );
    return tr;
  }));
}

// CSV for Excel / Sheets. Cells starting with = + - @ are prefixed with ' so a
// reply can't turn into a formula when the file is opened.
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function downloadCsv() {
  const head = ['Name', 'Email', 'Team', 'Attending', 'Plus one', 'Plus one name', 'Dietary', 'Message', 'First replied', 'Last updated'];
  const iso = (d) => (d ? d.toISOString() : '');
  const lines = [head, ...rows.map((r) => [
    r.name, r.email, r.department, r.attending, r.plusOne ? 'Yes' : 'No', r.plusOneName,
    r.dietary, r.message, iso(r.createdAt), iso(r.updatedAt),
  ])].map((l) => l.map(csvCell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zd-christmas-2026-rsvps.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function load() {
  $('#loading-text').textContent = 'Loading replies…';
  show('#loading-card');
  try {
    rows = await backend.listAll();
    render();
    show('#data-card');
  } catch (e) {
    const denied = e && e.code === 'permission-denied';
    setError(denied
      ? 'This account is not an organiser. Ask an organiser to add you, or sign in with a different account.'
      : friendly(e) || 'Could not load the replies.');
    show('#auth-card');
  }
}

$('#sign-in').addEventListener('click', async () => {
  const btn = $('#sign-in');
  setError('');
  btn.disabled = true; btn.classList.add('loading');
  try { await backend.signIn(); } catch (e) { setError(friendly(e)); }
  finally { btn.disabled = false; btn.classList.remove('loading'); }
});
$$('.sign-out').forEach((b) => b.addEventListener('click', () => { setError(''); backend.signOut(); }));
$('#refresh').addEventListener('click', load);
$('#csv').addEventListener('click', downloadCsv);
$('#search').addEventListener('input', render);
$$('.chip').forEach((chip) => chip.addEventListener('click', () => {
  filter = chip.dataset.filter;
  $$('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  render();
}));

getBackend(C).then((b) => {
  backend = b;
  $('#demo-banner').hidden = !b.demo;
  b.onUser((u, err) => {
    if (!u) { if (err) setError(err); show('#auth-card'); return; }
    $('#me-email').textContent = u.email;
    load();
  });
}).catch((e) => {
  setError('The page could not start: ' + (e.message || e));
  show('#auth-card');
});
