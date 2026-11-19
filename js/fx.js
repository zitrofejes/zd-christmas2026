// Visual effects: snow, the crumbling No button, floating polaroids and the BIG WIN celebration.

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);

// ── Snow ────────────────────────────────────────────────
export function snow(canvas) {
  const ctx = canvas.getContext('2d');
  let flakes = [];
  function size() {
    canvas.width = innerWidth; canvas.height = innerHeight;
    const n = reduceMotion ? 0 : Math.min(90, Math.floor(innerWidth / 9));
    flakes = Array.from({ length: n }, () => ({ x: rand(0, innerWidth), y: rand(0, innerHeight), r: rand(0.6, 2.4), v: rand(0.3, 0.9), w: rand(0, 6.3) }));
  }
  size();
  addEventListener('resize', size);
  (function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (const f of flakes) {
      f.y += f.v; f.w += 0.01; f.x += Math.sin(f.w) * 0.35;
      if (f.y > canvas.height) { f.y = -4; f.x = rand(0, canvas.width); }
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(frame);
  })();
}

// ── The No button falls apart ───────────────────────────
export function crumble(el) {
  return new Promise((resolve) => {
    if (reduceMotion) { el.style.visibility = 'hidden'; resolve(); return; }
    el.classList.add('shake');
    setTimeout(() => {
      el.classList.remove('shake');
      const r = el.getBoundingClientRect();
      const layer = document.createElement('div');
      layer.className = 'crumble-layer';
      Object.assign(layer.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      const cols = 4, rows = 4;
      // Jittered grid so the pieces look like broken stone, not squares.
      const pts = [];
      for (let y = 0; y <= rows; y++) {
        pts.push([]);
        for (let x = 0; x <= cols; x++) {
          const edge = x === 0 || y === 0 || x === cols || y === rows;
          pts[y].push([x / cols * 100 + (edge ? 0 : rand(-8, 8)), y / rows * 100 + (edge ? 0 : rand(-8, 8))]);
        }
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const piece = el.cloneNode(true);
          piece.removeAttribute('id');
          piece.setAttribute('aria-hidden', 'true');
          const p = [pts[y][x], pts[y][x + 1], pts[y + 1][x + 1], pts[y + 1][x]];
          piece.style.clipPath = `polygon(${p.map(([a, b]) => `${a}% ${b}%`).join(',')})`;
          piece.style.visibility = 'visible';
          layer.append(piece);
          piece.animate([
            { transform: 'translate(0,0) rotate(0)', opacity: 1 },
            { transform: `translate(${rand(-60, 60)}px, ${rand(260, 520)}px) rotate(${rand(-140, 140)}deg)`, opacity: 0 },
          ], { duration: rand(900, 1500), delay: (rows - y) * 60 + rand(0, 120), easing: 'cubic-bezier(.45,0,.9,.55)', fill: 'forwards' });
        }
      }
      document.body.append(layer);
      el.style.visibility = 'hidden';
      setTimeout(() => { layer.remove(); resolve(); }, 1900);
    }, 360);
  });
}

// ── Polaroids floating around the page ──────────────────
export function polaroids(container, photos) {
  container.replaceChildren(...photos.slice(0, 24).map((p, i) => {
    const el = document.createElement('figure');
    el.className = 'polaroid';
    el.style.margin = '0';
    // Keep them near the edges so they don't sit under the panel on phones.
    const side = i % 2 === 0;
    el.style.left = (side ? rand(-2, 18) : rand(70, 88)) + '%';
    el.style.top = rand(4, 86) + '%';
    el.style.setProperty('--r1', rand(-14, 0) + 'deg');
    el.style.setProperty('--r2', rand(0, 14) + 'deg');
    el.style.setProperty('--dx', rand(-30, 30) + 'px');
    el.style.setProperty('--dy', rand(-60, 60) + 'px');
    el.style.setProperty('--dur', rand(18, 34) + 's');
    el.style.animationDelay = -rand(0, 30) + 's';
    const img = document.createElement('img');
    img.src = p.data; img.alt = '';
    const cap = document.createElement('span');
    cap.textContent = (p.name || '').split(' ')[0];
    el.append(img, cap);
    return el;
  }));
}

// ── BIG WIN ─────────────────────────────────────────────
export function bigWin(overlay, amountEl, canvas, label) {
  return new Promise((resolve) => {
    overlay.hidden = false;
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth; canvas.height = innerHeight;
    const coins = [];
    const target = 1000000;
    const start = performance.now();
    const countMs = reduceMotion ? 1 : 4200;
    let raf;
    let done = false;
    const fmt = (n) => n.toLocaleString('en-GB');

    function spawn(n) {
      for (let i = 0; i < n; i++) {
        coins.push({ x: rand(0, canvas.width), y: rand(-80, -10), vx: rand(-1.5, 1.5), vy: rand(2, 6), r: rand(9, 17), spin: rand(0, 6.28), vs: rand(0.08, 0.25) });
      }
    }
    function drawCoin(c) {
      const w = Math.abs(Math.cos(c.spin)) * c.r;
      ctx.save(); ctx.translate(c.x, c.y);
      const g = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#f5c451'); g.addColorStop(1, '#9a6214');
      ctx.fillStyle = g; ctx.strokeStyle = '#6b3f08'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1.5, w), c.r, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function frame(now) {
      const t = Math.min(1, (now - start) / countMs);
      const eased = 1 - Math.pow(1 - t, 3);
      amountEl.textContent = fmt(Math.round(target * eased));
      if (!reduceMotion && t < 1) spawn(3);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.vy += 0.12; c.x += c.vx; c.y += c.vy; c.spin += c.vs;
        if (c.y > canvas.height + 30) coins.splice(i, 1); else drawCoin(c);
      }
      if (t >= 1 && !overlay.dataset.shook) { overlay.dataset.shook = '1'; overlay.classList.add('shake'); }
      if (!done) raf = requestAnimationFrame(frame);
    }
    function close() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      overlay.hidden = true;
      overlay.classList.remove('shake');
      delete overlay.dataset.shook;
      overlay.removeEventListener('click', close);
      resolve();
    }
    amountEl.setAttribute('aria-label', label || '');
    raf = requestAnimationFrame(frame);
    setTimeout(() => overlay.addEventListener('click', close), 600);
    setTimeout(close, 7500);
  });
}
