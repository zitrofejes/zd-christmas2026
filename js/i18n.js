// Tiny translation helper. Strings live in i18n/<code>.json; anything missing falls back to English.

export const LANGUAGES = [
  ['es', 'Castellano'], ['ca', 'Català'], ['val', 'Valencià'], ['bal', 'Mallorquí'],
  ['gl', 'Galego'], ['eu', 'Euskara'], ['oc', 'Aranés'], ['ast', 'Asturianu'],
  ['an', 'Aragonés'], ['leo', 'Llionés'], ['ext', 'Estremeñu'], ['fax', 'A Fala'],
  ['cant', 'Cántabru'], ['and', 'Andalûh'], ['can', 'Canario'], ['mur', 'Murciano'],
  ['clo', 'Caló'], ['llan', 'Llanito'], ['en', 'English'],
];

// BCP-47-ish tags for <html lang> so screen readers pick a sensible voice.
const HTML_LANG = { val: 'ca', bal: 'ca', oc: 'oc', leo: 'ast', ext: 'es', fax: 'gl', cant: 'es', and: 'es', can: 'es', mur: 'es', clo: 'es', llan: 'en' };

let en = null;
let dict = {};
let current = 'en';

async function fetchJson(code) {
  const r = await fetch(`i18n/${code}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('Missing ' + code);
  return r.json();
}

export async function setLanguage(code) {
  if (!en) en = await fetchJson('en');
  try { dict = code === 'en' ? en : await fetchJson(code); current = code; }
  catch (e) { dict = en; current = 'en'; }
  document.documentElement.lang = HTML_LANG[current] || current;
  apply();
  return current;
}

export const language = () => current;

export function t(key, vars = {}) {
  const s = (dict && dict[key]) ?? (en && en[key]) ?? key;
  return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
}

/** Fills every [data-i18n] / [data-i18n-ph] / [data-i18n-label] element under root. */
export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
}

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Formats a date with the translated month/weekday names, in the event's time zone. */
export function formatDate(date, long, timeZone) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(date).forEach((p) => { parts[p.type] = p.value; });
  const months = t('_months');
  const weekdays = t('_weekdays');
  return t(long ? '_dateLong' : '_dateShort', {
    weekday: Array.isArray(weekdays) ? weekdays[WD[parts.weekday]] : parts.weekday,
    day: parts.day,
    month: Array.isArray(months) ? months[Number(parts.month) - 1] : parts.month,
    year: parts.year,
  });
}

export function formatTime(date, timeZone) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
}
