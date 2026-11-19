(function () {
  'use strict';
  var C = window.RSVP_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var configured = C.scriptUrl && C.scriptUrl.indexOf('PASTE_') !== 0;

  // ── Event details ────────────────────────────────────────
  var start = new Date(C.start);
  var end = new Date(C.end);
  var dateFmt = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  var timeFmt = { hour: '2-digit', minute: '2-digit' };

  document.title = C.title + ' · RSVP';
  $('#event-title').textContent = C.title;
  $('#event-tagline').textContent = C.tagline;
  $('#event-date').textContent = start.toLocaleDateString('en-GB', dateFmt);
  $('#event-time').textContent = start.toLocaleTimeString('en-GB', timeFmt) + ' – ' + end.toLocaleTimeString('en-GB', timeFmt);
  $('#event-venue').textContent = C.venue;
  if (C.rsvpDeadline) {
    $('#deadline-note').textContent = 'Please reply by ' +
      new Date(C.rsvpDeadline + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) + '.';
  }
  var contact = $('#contact');
  contact.textContent = C.contactName;
  if (C.contactEmail) contact.href = 'mailto:' + C.contactEmail;
  if (!C.allowPlusOne) { $('#plusone-wrap').remove(); }

  // ── Countdown ────────────────────────────────────────────
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    var ms = start - new Date();
    if (ms <= 0) { $('#countdown').innerHTML = '<p class="live">🎉 It\'s party time!</p>'; return; }
    var s = Math.floor(ms / 1000);
    $('#cd-d').textContent = Math.floor(s / 86400);
    $('#cd-h').textContent = pad(Math.floor(s / 3600) % 24);
    $('#cd-m').textContent = pad(Math.floor(s / 60) % 60);
    $('#cd-s').textContent = pad(s % 60);
    setTimeout(tick, 1000);
  }
  tick();

  // ── Headcount ────────────────────────────────────────────
  function loadHeadcount() {
    if (!configured || !C.showHeadcount) return;
    fetch(C.scriptUrl).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok || !d.attending) return;
      var el = $('#headcount');
      el.textContent = d.attending === 1 ? '1 person is coming so far' : d.attending + ' people are coming so far';
      el.hidden = false;
    }).catch(function () {});
  }
  loadHeadcount();

  // ── Form behaviour ───────────────────────────────────────
  var form = $('#rsvp');
  var coming = $('.when-coming', form);
  var plusName = $('.plusone-name', form);

  // Restore a previous answer on this device so editing is easy.
  try {
    var saved = JSON.parse(localStorage.getItem('zd-rsvp') || 'null');
    if (saved) fill(saved);
  } catch (e) {}

  function fill(d) {
    ['name', 'email', 'department', 'plusOneName', 'dietary', 'message'].forEach(function (k) {
      if (d[k] != null && form.elements[k]) form.elements[k].value = d[k];
    });
    if (form.elements.plusOne) form.elements.plusOne.checked = !!d.plusOne;
    var r = form.querySelector('input[name="attending"][value="' + d.attending + '"]');
    if (r) r.checked = true;
    sync();
  }

  function sync() {
    var a = form.elements.attending.value;
    coming.hidden = !(a === 'Yes' || a === 'Maybe');
    plusName.hidden = !(form.elements.plusOne && form.elements.plusOne.checked);
  }
  form.addEventListener('change', sync);

  function showError(msg) {
    var el = $('#error');
    el.textContent = msg;
    el.hidden = !msg;
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError('');
    var f = form.elements;
    var data = {
      attending: f.attending.value,
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      department: f.department.value.trim(),
      plusOne: !!(f.plusOne && f.plusOne.checked),
      plusOneName: f.plusOneName.value.trim(),
      dietary: f.dietary.value.trim(),
      message: f.message.value.trim(),
      website: f.website.value,
    };

    if (!data.attending) return showError('Please let us know if you can make it.');
    if (!data.name) { f.name.focus(); return showError('Please enter your name.'); }
    if (!f.email.checkValidity() || !data.email) { f.email.focus(); return showError('Please enter a valid email.'); }
    if (!configured) return showError('This form is not connected yet (scriptUrl missing in config.js).');

    var btn = $('#submit');
    btn.disabled = true;
    btn.classList.add('loading');

    // text/plain avoids a CORS preflight, which Apps Script does not support.
    fetch(C.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Something went wrong.');
        try { localStorage.setItem('zd-rsvp', JSON.stringify(data)); } catch (e) {}
        thanks(data, res.updated);
        loadHeadcount();
      })
      .catch(function (err) {
        showError(err.message && err.message !== 'Failed to fetch'
          ? err.message
          : 'Could not reach the server. Please check your connection and try again.');
      })
      .finally(function () {
        btn.disabled = false;
        btn.classList.remove('loading');
      });
  });

  // ── Thank-you state ──────────────────────────────────────
  var copy = {
    Yes: ['🎉', 'See you there!', 'Your spot is saved. We can\'t wait to celebrate with you.'],
    Maybe: ['🤞', 'Thanks for letting us know', 'We\'ve noted you as a maybe. Please update your answer once you know.'],
    No: ['🎄', 'We\'ll miss you', 'Thanks for replying. Have a wonderful holiday season!'],
  };

  function thanks(d, updated) {
    var c = copy[d.attending];
    $('#thanks-emoji').textContent = c[0];
    $('#thanks-title').textContent = (updated ? 'Updated. ' : '') + c[1];
    $('#thanks-text').textContent = c[2];
    $('#add-cal').hidden = d.attending === 'No';
    $('#form-card').hidden = true;
    var t = $('#thanks');
    t.hidden = false;
    t.focus();
    if (d.attending === 'Yes') burst();
  }

  $('#again').addEventListener('click', function () {
    $('#thanks').hidden = true;
    $('#form-card').hidden = false;
    form.elements.name.focus();
  });

  // ── Calendar file ────────────────────────────────────────
  function ics(dt) { return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  var cal = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ZD//RSVP//EN', 'BEGIN:VEVENT',
    'UID:zd-christmas-2026@rsvp', 'DTSTAMP:' + ics(new Date()),
    'DTSTART:' + ics(start), 'DTEND:' + ics(end),
    'SUMMARY:' + C.title, 'LOCATION:' + C.venue, 'DESCRIPTION:' + C.tagline,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  $('#add-cal').href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(cal);

  // ── Snow + confetti ──────────────────────────────────────
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = $('#snow'), ctx = cv.getContext('2d'), flakes = [], bits = [];
  function size() { cv.width = innerWidth; cv.height = innerHeight; }
  size();
  addEventListener('resize', size);
  var count = reduce ? 0 : Math.min(120, Math.floor(innerWidth / 10));
  for (var i = 0; i < count; i++) {
    flakes.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 2.2 + 0.6, v: Math.random() * 0.6 + 0.3, w: Math.random() * Math.PI * 2 });
  }
  function burst() {
    if (reduce) return;
    var cols = ['#e63946', '#f1c453', '#2a9d8f', '#ffffff', '#8ecae6'];
    for (var i = 0; i < 160; i++) {
      bits.push({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * -12 - 3, s: Math.random() * 6 + 4, c: cols[i % cols.length],
        a: Math.random() * Math.PI, life: 160 });
    }
  }
  function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    flakes.forEach(function (f) {
      f.y += f.v; f.w += 0.01; f.x += Math.sin(f.w) * 0.4;
      if (f.y > cv.height) { f.y = -5; f.x = Math.random() * cv.width; }
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    });
    bits = bits.filter(function (b) { return b.life-- > 0; });
    bits.forEach(function (b) {
      b.vy += 0.3; b.x += b.vx; b.y += b.vy; b.vx *= 0.99; b.a += 0.2;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
      ctx.fillStyle = b.c; ctx.globalAlpha = Math.min(1, b.life / 40);
      ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore();
    });
    requestAnimationFrame(frame);
  }
  frame();
})();
