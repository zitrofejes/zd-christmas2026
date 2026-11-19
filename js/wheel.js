// The prize wheel: drawn as SVG, spun with CSS transforms.
// The outcome is decided before the spin starts; the wheel just animates to it.
// Every spin "almost" stops on the microwave first, then creeps on to the real result.

const NS = 'http://www.w3.org/2000/svg';
const R = 190;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
}

/** Splits a label into at most two balanced lines. */
function lines(text) {
  if (text.length <= 13 || !text.includes(' ')) return [text];
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [text.slice(0, best), text.slice(best + 1)];
}

export function createWheel(svg, ids, opts = {}) {
  const n = ids.length;
  const step = 360 / n;
  const special = opts.special || {};
  let rot = 0;
  let spinning = false;

  function render(labelFor) {
    svg.replaceChildren();
    const defs = el('defs', {}, svg);
    const grads = {
      a: ['#5a2c80', '#2a1340'],
      b: ['#138a90', '#0a3c4a'],
      gold: ['#ffe9a3', '#c8891e'],
    };
    for (const [id, [c1, c2]] of Object.entries(grads)) {
      const g = el('radialGradient', { id: 'seg-' + id, cx: '0', cy: '0', r: R, gradientUnits: 'userSpaceOnUse' }, defs);
      el('stop', { offset: '0.25', 'stop-color': c1 }, g);
      el('stop', { offset: '1', 'stop-color': c2 }, g);
    }
    const rim = el('linearGradient', { id: 'rim', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    [['0', '#fff0b8'], ['0.35', '#f5c451'], ['0.7', '#9a6214'], ['1', '#f5c451']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, rim));

    el('circle', { r: R + 16, fill: 'url(#rim)', stroke: '#4a2a06', 'stroke-width': 3 }, svg);
    el('circle', { r: R + 2, fill: '#2a1340' }, svg);

    ids.forEach((id, i) => {
      const a0 = (i * step - 90 - step / 2) * Math.PI / 180;
      const a1 = (i * step - 90 + step / 2) * Math.PI / 180;
      const fill = special[id] === 'gold' ? 'url(#seg-gold)' : (i % 2 ? 'url(#seg-b)' : 'url(#seg-a)');
      el('path', {
        d: `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`,
        fill, stroke: '#e9b949', 'stroke-width': 2,
      }, svg);

      // Label along the radius, reading from the hub outwards.
      // Labels on the left half are flipped so they never read upside down.
      const ang = i * step - 90;
      const flip = ang > 90 && ang < 270;
      const g = el('g', { transform: `rotate(${ang})${flip ? ' rotate(180 132 0)' : ''}` }, svg);
      const text = labelFor(id);
      const ls = lines(text);
      const longest = Math.max(...ls.map((l) => l.length));
      const fs = Math.max(8.5, Math.min(16, 104 / (0.56 * longest)));
      const t = el('text', {
        x: 132, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Cinzel, Georgia, serif', 'font-weight': 800, 'font-size': fs.toFixed(1),
        fill: special[id] === 'gold' ? '#3b1d05' : '#fff4d6',
        stroke: special[id] === 'gold' ? 'none' : 'rgba(0,0,0,.35)', 'stroke-width': 0.6, 'paint-order': 'stroke',
      }, g);
      ls.forEach((l, k) => {
        const span = el('tspan', { x: 132, dy: k === 0 ? (-(ls.length - 1) * 0.55 * fs).toFixed(1) : (1.1 * fs).toFixed(1) }, t);
        span.textContent = l;
      });
    });

    // Light bulbs around the rim, like a casino wheel.
    for (let i = 0; i < n * 2; i++) {
      const a = (i * step / 2 - 90) * Math.PI / 180;
      el('circle', { cx: (R + 8) * Math.cos(a), cy: (R + 8) * Math.sin(a), r: 3.6, fill: i % 2 ? '#fff6c8' : '#37e0d6', class: 'bulb' }, svg);
    }
  }

  function setRot(deg, ms, easing) {
    svg.style.transition = ms ? `transform ${ms}ms ${easing}` : 'none';
    svg.style.transform = `rotate(${deg}deg)`;
    rot = deg;
    return wait(ms + 40);
  }

  /** Rotation that puts segment i under the top pointer, at least `turns` full turns ahead. */
  function target(i, from, turns, jitter) {
    const want = -i * step + jitter;
    const d = (((want - from) % 360) + 360) % 360;
    return from + turns * 360 + d;
  }

  // Wiggle the pointer every time a segment boundary passes under it.
  function ticker(pointer) {
    let last = null;
    let raf;
    (function loop() {
      const m = getComputedStyle(svg).transform;
      if (m && m !== 'none') {
        const [a, b] = m.slice(7, -1).split(',').map(Number);
        const deg = Math.atan2(b, a) * 180 / Math.PI;
        const seg = Math.floor((((deg + step / 2) % 360) + 360) % 360 / step);
        if (last !== null && seg !== last && pointer) {
          pointer.classList.remove('tick'); void pointer.offsetWidth; pointer.classList.add('tick');
        }
        last = seg;
      }
      raf = requestAnimationFrame(loop);
    })();
    return () => cancelAnimationFrame(raf);
  }

  /**
   * Spins to ids[index]. First it nearly stops on `nearMiss` (the microwave),
   * calls onNearMiss, then creeps on to the real result.
   */
  async function spinTo(index, { nearMiss, onNearMiss, pointer, reduced } = {}) {
    if (spinning) return;
    spinning = true;
    const stop = ticker(pointer);
    try {
      if (reduced) { await setRot(target(index, rot, 1, 0), 600, 'ease-out'); return; }
      const nm = ids.indexOf(nearMiss);
      if (nm >= 0 && nm !== index) {
        // Stop just short of the boundary, so it looks like it almost landed.
        await setRot(target(nm, rot, 5, step * 0.42), 4800, 'cubic-bezier(.12,.62,.18,1)');
        if (onNearMiss) onNearMiss();
        await wait(900);
        let to = target(index, rot, 0, (Math.random() - 0.5) * step * 0.5);
        if (to - rot < 12) to += 360;
        await setRot(to, 900 + (to - rot) / 360 * 2600, 'cubic-bezier(.35,.05,.25,1)');
      } else {
        await setRot(target(index, rot, 6, (Math.random() - 0.5) * step * 0.5), 5200, 'cubic-bezier(.12,.62,.18,1)');
      }
    } finally {
      stop();
      spinning = false;
    }
  }

  /** Jump straight to a segment (used when showing an earlier result). */
  function show(index) { setRot(-index * step, 0); }

  return { render, spinTo, show };
}
