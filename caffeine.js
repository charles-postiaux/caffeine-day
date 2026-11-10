// Caffeine Day — how much caffeine is still in you at bedtime.
// One file, no dependencies. Usage:
//   import { mount } from './caffeine.js';
//   mount(document.getElementById('caffeine'));
// The element needs a height; the chart fills it, the drink panel sits under it.
// MIT licence, Charles Postiaux / Baobun Studio.

// ─── Model ────────────────────────────────────────────────────────────────
// One-compartment model with first-order absorption:
//   C(t) = Σ dose · kₐ/(kₐ − kₑ) · (e^(−kₑ·d) − e^(−kₐ·d)),  d = hours since the drink
// Absorption half-life 15 min (peak about an hour after drinking), elimination
// half-life 5 h (healthy adults typically range 3 to 7 h). It ignores body
// weight, pregnancy, smoking and medication, all of which change the half-life.
export const ABSORPTION_HALF_LIFE = 0.25;
export const HALF_LIFE = 5;
const ka = Math.LN2 / ABSORPTION_HALF_LIFE;
const ke = Math.LN2 / HALF_LIFE;
export const unit = (d) => (d <= 0 ? 0 : (ka / (ka - ke)) * (Math.exp(-ke * d) - Math.exp(-ka * d)));

// Typical caffeine per serving (Mayo Clinic / USDA figures). Real drinks vary a lot.
export const DRINKS = [
  { id: 'coffee', name: 'Coffee', mg: 95, ml: 240, min: 100, max: 600, step: 10 },
  { id: 'espresso', name: 'Espresso', mg: 63, ml: 30, min: 15, max: 120, step: 5 },
  { id: 'cold-brew', name: 'Cold brew', mg: 205, ml: 473, min: 150, max: 700, step: 10 },
  { id: 'black-tea', name: 'Black tea', mg: 47, ml: 240, min: 100, max: 600, step: 10 },
  { id: 'green-tea', name: 'Green tea', mg: 28, ml: 240, min: 100, max: 600, step: 10 },
  { id: 'cola', name: 'Cola', mg: 34, ml: 355, min: 150, max: 1000, step: 10 },
  { id: 'energy', name: 'Energy drink', mg: 80, ml: 250, min: 150, max: 700, step: 10 },
];
const DRINK = Object.fromEntries(DRINKS.map((d) => [d.id, d]));
export const doseOf = (drink, ml) => (DRINK[drink].mg / DRINK[drink].ml) * ml;

const H0 = 6, H1 = 30, LINE = 50, MAX_CUPS = 10;
const BED_MIN = 19, BED_MAX = 28;
const DEFAULT = { bed: 23, cups: [['coffee', 240, 8], ['coffee', 240, 11], ['coffee', 240, 15.5]] };

// ─── Look ─────────────────────────────────────────────────────────────────
const C = { bg: '#0E0E0E', faint: '#1F1F1F', dim: '#3A3A3A', mid: '#6E6E6E', ink: '#D4D4D4', white: '#ECECEC', accent: '#3B82F6' };
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const spring = (x, v, target, k, c, dt) => { v += (-k * (x - target) - c * v) * dt; return [x + v * dt, v]; };
const clock = (h) => {
  const m = ((Math.round(h * 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const CSS = `
.cd { display: flex; flex-direction: column; height: 100%; background: ${C.bg}; color: ${C.ink}; font: 400 11px/16px ${MONO}; letter-spacing: 0.02em; text-transform: uppercase; -webkit-user-select: none; user-select: none; }
.cd-stage { position: relative; flex: 1 1 0; min-height: 0; }
.cd-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; outline: none; }
.cd-stage canvas:focus-visible { box-shadow: inset 0 0 0 2px ${C.accent}; }
.cd-panel { flex: none; padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); }
.cd-in { display: grid; gap: 12px; max-width: 760px; margin: 0 auto; }
.cd-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 24px; }
.cd-head b { font-weight: 500; color: ${C.white}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cd-head span { color: ${C.mid}; }
.cd button { font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; outline: none; }
.cd button:focus-visible, .cd input:focus-visible { box-shadow: 0 0 0 2px ${C.bg}, 0 0 0 3px ${C.accent}; }
.cd .cd-remove { color: ${C.mid}; padding: 4px 0 4px 8px; flex: none; }
.cd-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 0 16px; }
.cd-chips::-webkit-scrollbar { display: none; }
.cd .cd-chip { flex: none; height: 32px; padding: 0 12px; border-radius: 100px; box-shadow: inset 0 0 0 1px #262626; color: ${C.mid}; white-space: nowrap; }
.cd .cd-chip[aria-pressed="true"] { color: ${C.white}; background: #1A1A1A; box-shadow: inset 0 0 0 1px ${C.mid}; }
.cd-vol { display: flex; align-items: center; gap: 12px; }
.cd-vol output { flex: none; width: 64px; color: ${C.white}; font-variant-numeric: tabular-nums; }
.cd-vol output:last-child { text-align: right; color: ${C.ink}; }
.cd-vol input { flex: 1 1 0; min-width: 0; height: 32px; margin: 0; background: none; -webkit-appearance: none; appearance: none; outline: none; cursor: pointer; }
.cd-vol input::-webkit-slider-runnable-track { height: 2px; background: ${C.dim}; border-radius: 2px; }
.cd-vol input::-moz-range-track { height: 2px; background: ${C.dim}; border-radius: 2px; }
.cd-vol input::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -7px; border-radius: 50%; background: ${C.white}; border: 0; }
.cd-vol input::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: ${C.white}; border: 0; }
.cd-empty { color: ${C.mid}; padding: 8px 0; }
.cd [hidden] { display: none !important; }
@media (hover: hover) and (pointer: fine) { .cd .cd-chip:hover, .cd .cd-remove:hover, .cd .cd-close:hover { color: ${C.white}; } }
.cd-widget { position: relative; width: min(360px, calc(100vw - 32px)); height: auto; aspect-ratio: 1; border-radius: 20px; overflow: hidden; cursor: pointer; }
.cd-widget::after { content: ''; position: absolute; inset: 0; z-index: 3; border-radius: inherit; box-shadow: inset 0 0 0 1px #262626; pointer-events: none; transition: box-shadow 150ms ease; }
.cd-widget.cd-open::after { display: none; }
.cd-widget:not(.cd-open) .cd-panel, .cd-widget:not(.cd-open) .cd-close { display: none; }
.cd-widget:not(.cd-open) canvas { pointer-events: none; }
.cd-widget:focus-visible { outline: none; }
.cd-widget:focus-visible::after { box-shadow: inset 0 0 0 1px ${C.accent}; }
@media (hover: hover) and (pointer: fine) { .cd-widget:not(.cd-open):hover::after { box-shadow: inset 0 0 0 1px ${C.dim}; } }
.cd-widget.cd-open { position: fixed; inset: 0; width: auto; aspect-ratio: auto; border-radius: 0; z-index: 1000; cursor: auto; }
.cd .cd-close { position: absolute; z-index: 2; top: calc(12px + env(safe-area-inset-top)); right: 14px; padding: 8px 10px; color: ${C.mid}; }
`;

// ─── State in the URL, so a day can be shared ─────────────────────────────
// #coffee.240.0800_espresso.30.1100~bed.2300
function readHash() {
  try {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return null;
    const [list, bedPart] = h.split('~');
    const hm = (s) => { const n = parseInt(s, 10); return Math.floor(n / 100) + (n % 100) / 60; };
    const cups = (list || '').split('_').filter(Boolean).map((s) => s.split('.')).filter(([d, ml, t]) => DRINK[d] && +ml > 0 && /^\d{3,4}$/.test(t))
      .map(([d, ml, t]) => [d, clamp(+ml, DRINK[d].min, DRINK[d].max), (hm(t) < H0 ? hm(t) + 24 : hm(t))]).slice(0, MAX_CUPS);
    let bed = DEFAULT.bed;
    if (bedPart?.startsWith('bed.')) { const b = hm(bedPart.slice(4)); bed = clamp(b < 12 ? b + 24 : b, BED_MIN, BED_MAX); }
    return { cups, bed };
  } catch { return null; }
}
const hhmm = (h) => clock(h).replace(':', '');

// ─── Mount ────────────────────────────────────────────────────────────────
export function mount(root, { hash = true, widget = false } = {}) {
  if (!document.getElementById('cd-style')) {
    const st = document.createElement('style');
    st.id = 'cd-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  root.classList.add('cd');
  root.innerHTML = `
    <div class="cd-stage"><canvas tabindex="0" aria-label="Caffeine in your body across the day. Drag a drink along the day, tap empty space to add one. Arrow keys move the selected drink, delete removes it."></canvas></div>
    <div class="cd-panel"><div class="cd-in">
      <div class="cd-head"><b class="cd-title"></b><button class="cd-remove" type="button">Remove</button></div>
      <div class="cd-chips" role="group" aria-label="Drink">${DRINKS.map((d) => `<button class="cd-chip" type="button" data-id="${d.id}">${d.name}</button>`).join('')}</div>
      <div class="cd-vol"><output class="cd-ml"></output><input type="range" aria-label="Volume in millilitres"><output class="cd-mg"></output></div>
      <div class="cd-empty" hidden>Tap the chart to add a drink</div>
    </div></div>${widget ? '<button class="cd-close" type="button">Close</button>' : ''}`;

  const el = root.querySelector('canvas');
  const ctx = el.getContext('2d');
  const $ = (s) => root.querySelector(s);
  const title = $('.cd-title'), removeBtn = $('.cd-remove'), range = $('.cd-vol input'), mlOut = $('.cd-ml'), mgOut = $('.cd-mg');
  const chips = [...root.querySelectorAll('.cd-chip')];
  const empty = $('.cd-empty');
  const editors = [$('.cd-head'), $('.cd-chips'), $('.cd-vol')];

  // Canvas at device resolution.
  const s = { w: 0, h: 0 };
  let geo = {}, cols = 0, rows = 0, mg = new Float32Array(0);
  const PAD = 24;
  // Lay the chart out inside a frame F (in canvas pixels). While the widget
  // opens or closes, F moves between the card and the full canvas, and `lock`
  // keeps the dot grid and the label rules fixed so nothing pops on the way.
  function layout(F, lock) {
    const small = lock ? lock.small : F.w < 620;
    const fw = small ? F.w * 0.76 : Math.min(F.w * 0.68, 1000);
    const fh = small ? F.h * 0.4 : Math.min(F.h * 0.5, fw * 0.55);
    const c = lock ? lock.cols : Math.max(20, Math.round(fw / (small ? 4 : clamp(fw / 150, 5, 7))));
    const r = lock ? lock.rows : Math.max(10, Math.round(fh / (small ? 4 : clamp(fw / 150, 5, 7))));
    const round = lock ? (v) => v : Math.round;
    return { small, fw: round(fw), fh: round(fh), pitch: Math.min(fw / c, fh / r), cols: c, rows: r, ox: F.x, oy: F.y, W: F.w, H: F.h,
      fx: round(F.x + (F.w - fw) / 2), fy: round(F.y + F.h * (small ? 0.56 : 0.54) - fh / 2) };
  }
  function geometry() {
    geo = layout({ x: 0, y: 0, w: s.w, h: s.h });
    cols = geo.cols; rows = geo.rows;
    mg = new Float32Array(cols);
  }
  // The open / close morph: frame from -> to over dur ms on the drawer curve.
  let morph = null;
  const bez = (x1, y1, x2, y2) => (t) => {
    const cx = (u) => 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3;
    const cy = (u) => 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (cx(m) < t) lo = m; else hi = m; }
    return cy((lo + hi) / 2);
  };
  const drawer = bez(0.32, 0.72, 0, 1);
  const morphGeo = (now) => {
    const e = drawer(clamp((now - morph.t0) / morph.dur, 0, 1));
    const m = (k) => morph.from[k] + (morph.to[k] - morph.from[k]) * e;
    morph.e = e;
    return layout({ x: m('x'), y: m('y'), w: m('w'), h: m('h') }, morph.lock);
  }
  const fit = () => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    s.w = r.width; s.h = r.height;
    el.width = Math.round(r.width * dpr); el.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geometry();
    if (ready) draw(0);
  };
  let ready = false;
  new ResizeObserver(fit).observe(el);
  fit();

  // Drinks and bedtime.
  const start = (hash && readHash()) || DEFAULT;
  const makeCup = (drink, ml, x) => ({ drink, ml, x, v: 0, target: x, a: 0, hold: 0, mg: doseOf(drink, ml), mgV: 0 });
  const cups = start.cups.map(([d, ml, x]) => makeCup(d, ml, x));
  const bed = { x: start.bed, v: 0, target: start.bed };
  let selected = cups[cups.length - 1] || null;
  let grabbed = null, down = null, touched = !!(hash && location.hash.length > 1), yMax = 240, yV = 0, tour = 0, lastHash = '';

  const timeAt = (px) => H0 + ((px - geo.fx) / geo.fw) * (H1 - H0);
  let drawGeo = null;
  const xAt = (h) => { const g = drawGeo || geo; return g.fx + ((h - H0) / (H1 - H0)) * g.fw; };
  const at = (h, list = cups) => { let n = 0; for (const c of list) n += c.mg * unit(h - c.x); return n; };
  const labelY = () => geo.fy - (geo.small ? 8 : 18);

  // ── Panel ──
  function sync() {
    const c = selected;
    editors.forEach((e) => (e.hidden = !c));
    empty.hidden = !!c;
    if (!c) return;
    const d = DRINK[c.drink];
    const sorted = [...cups].sort((a, b) => a.x - b.x);
    title.textContent = `${d.name} · ${clock(c.target)} · drink ${sorted.indexOf(c) + 1} of ${cups.length}`;
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === c.drink)));
    range.min = d.min; range.max = d.max; range.step = d.step; range.value = c.ml;
    mlOut.textContent = `${c.ml} ml`;
    mgOut.textContent = `${Math.round(doseOf(c.drink, c.ml))} mg`;
  }
  const poke = (c) => { c.hold = 1.8; touched = true; };
  chips.forEach((b) => b.addEventListener('click', () => {
    if (!selected) return;
    const d = DRINK[b.dataset.id];
    // Keep the drink's usual size unless the current volume still makes sense for it.
    selected.ml = selected.drink === d.id ? selected.ml : d.ml === 473 ? 470 : d.ml;
    selected.drink = d.id;
    poke(selected); sync();
  }));
  range.addEventListener('input', () => { if (!selected) return; selected.ml = +range.value; poke(selected); sync(); });
  function remove(c) {
    if (!c) return;
    cups.splice(cups.indexOf(c), 1);
    selected = cups.length ? cups.reduce((a, b) => (Math.abs(b.x - c.x) < Math.abs(a.x - c.x) ? b : a)) : null;
    touched = true; sync();
  }
  removeBtn.addEventListener('click', () => remove(selected));
  sync();

  // ── Pointer ──
  const p = { x: -1e4, y: -1e4, vx: 0, inside: false, t: 0, touch: false };
  const reach = () => (p.touch ? 26 : 18);
  const inZone = () => p.y > geo.fy - 40 && p.y < geo.fy + geo.fh + 50;
  const nearestCup = () => {
    if (!inZone()) return null;
    let best = null, d = reach();
    for (const c of cups) { const dx = Math.abs(xAt(c.x) - p.x); if (dx < d) { d = dx; best = c; } }
    return best;
  };
  const onBed = () => {
    const bx = xAt(bed.x), ly = labelY();
    const onLine = Math.abs(p.x - bx) < (p.touch ? 14 : 8) && p.y > ly - 24 && p.y < geo.fy + geo.fh;
    const onLabel = p.x > bx - 6 && p.x < bx + 150 && p.y > ly - 30 && p.y < ly + 8;
    return onLine || onLabel;
  };
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const dt = Math.max((e.timeStamp - p.t) / 1000, 1 / 240);
    if (p.inside && p.t) p.vx = p.vx * 0.6 + ((x - p.x) / dt) * 0.4;
    p.t = e.timeStamp; p.x = x; p.y = y; p.inside = true; p.touch = e.pointerType === 'touch';
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', () => { if (!grabbed) { p.inside = false; p.vx = 0; } });
  el.addEventListener('pointerdown', (e) => {
    try { el.setPointerCapture(e.pointerId); } catch {}
    p.t = 0; move(e);
    touched = true;
    if (onBed() && !nearestCup()) { grabbed = bed; down = { dx: p.x - xAt(bed.x) }; return; }
    let c = nearestCup();
    if (!c && p.x > geo.fx - 4 && p.x < geo.fx + geo.fw + 4 && inZone() && cups.length < MAX_CUPS) {
      const like = selected || { drink: 'coffee', ml: 240 };
      c = makeCup(like.drink, like.ml, clamp(Math.round(timeAt(p.x) * 4) / 4, H0, H1));
      c.mg = 0;
      cups.push(c);
    }
    if (!c) return;
    selected = c; grabbed = c;
    down = { dx: p.x - xAt(c.x) };
    c.v = 0; c.hold = 99;
    sync();
  });
  const up = () => {
    if (!grabbed) return;
    const g = grabbed;
    grabbed = null;
    const v = clamp((p.vx / geo.fw) * (H1 - H0), -6, 6);
    if (g === bed) { bed.v = v; bed.target = clamp(Math.round((bed.x + v * 0.08) * 4) / 4, BED_MIN, BED_MAX); return; }
    g.v = v;
    g.target = clamp(Math.round((g.x + v * 0.08) * 4) / 4, H0, H1);
    g.hold = 1.8;
    sync();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', (e) => {
    if (!selected) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 0.25);
      selected.target = clamp(Math.round((selected.target + d) * 4) / 4, H0, H1);
      poke(selected); sync();
    } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(selected); }
    else if (e.key === '[' || e.key === ']') {
      const sorted = [...cups].sort((a, b) => a.x - b.x);
      const i = sorted.indexOf(selected) + (e.key === ']' ? 1 : -1);
      selected = sorted[(i + sorted.length) % sorted.length]; poke(selected); sync();
    }
  });

  // ── Drawing ──
  const LEVELS = 14;
  const greys = Array.from({ length: LEVELS }, (_, i) => { const g = Math.round(44 + 194 * (i / (LEVELS - 1)) ** 1.05); return `rgb(${g},${g},${g})`; });
  const buckets = Array.from({ length: LEVELS }, () => []);
  const blues = [];
  const text = (str, x, y, color, size = 10, weight = 400, align = 'left') => {
    ctx.font = `${weight} ${size}px ${MONO}`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const paint = (list) => {
    ctx.beginPath();
    for (let n = 0; n < list.length; n += 3) {
      const r = list[n + 2];
      if (r < 1) ctx.rect(list[n] - r, list[n + 1] - r, r * 2, r * 2);
      else { ctx.moveTo(list[n] + r, list[n + 1]); ctx.arc(list[n], list[n + 1], r, 0, 6.2832); }
    }
    ctx.fill();
  };

  ready = true;
  let last = performance.now(), alive = true;
  const frame = (now) => {
    if (!alive) return;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (s.w && s.h) draw(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  function draw(dt) {
    const G = morph ? morphGeo(performance.now()) : geo;
    if (G.cols !== cols || G.rows !== rows) { cols = G.cols; rows = G.rows; mg = new Float32Array(cols); }
    const { fx, fy, fw, fh, pitch, small } = G;
    drawGeo = G;
    // How open the widget is, 0 to 1: drives the parts only the full view shows.
    const openness = !widget ? 1 : morph ? (morph.closing ? 1 - morph.e : morph.e) : root.classList.contains('cd-open') ? 1 : 0;

    if (grabbed) {
      const raw = timeAt(p.x - down.dx);
      const lo = grabbed === bed ? BED_MIN : H0, hi = grabbed === bed ? BED_MAX : H1;
      grabbed.x = raw < lo ? lo - (lo - raw) * 0.25 : raw > hi ? hi + (raw - hi) * 0.25 : raw;
      grabbed.target = clamp(Math.round(grabbed.x * 4) / 4, lo, hi);
      if (grabbed !== bed) title.textContent = title.textContent.replace(/\d\d:\d\d/, clock(grabbed.target));
    }
    if (grabbed !== bed) [bed.x, bed.v] = spring(bed.x, bed.v, bed.target, 220, 2 * Math.sqrt(220), dt);

    // Until someone touches it, each drink's share lights up in turn.
    if (!touched) tour += dt;
    const toured = !touched && cups.length ? [...cups].sort((a, b) => a.x - b.x)[Math.floor(tour / 2.6) % cups.length] : null;
    for (const c of cups) {
      if (c !== grabbed) [c.x, c.v] = spring(c.x, c.v, c.target, 220, 2 * Math.sqrt(220), dt);
      [c.mg, c.mgV] = spring(c.mg, c.mgV, doseOf(c.drink, c.ml), 160, 2 * Math.sqrt(160), dt);
      if (c.mg < 0) c.mg = 0;
      if (c.hold > 0 && c !== grabbed) c.hold -= dt;
      const on = c === grabbed || c === toured || c.hold > 0;
      c.a += ((on ? 1 : 0) - c.a) * Math.min(1, dt * 10);
    }
    const active = cups.reduce((b, c) => (c.a > (b?.a ?? 0.02) ? c : b), null);

    let peak = 0, peakAt = H0;
    for (let c = 0; c < cols; c++) {
      const h = H0 + ((c + 0.5) / cols) * (H1 - H0);
      mg[c] = at(h);
      if (mg[c] > peak) { peak = mg[c]; peakAt = h; }
    }
    [yMax, yV] = spring(yMax, yV, Math.max(200, peak * 1.2), 60, 15, dt);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, s.w, s.h);

    // The lit ridge: light from the upper left, climbing slopes catch it,
    // falling ones sit in shade, depth fades to almost nothing.
    for (const b of buckets) b.length = 0;
    blues.length = 0;
    const near = [], far = [];
    const base = fy + fh, cw = fw / cols, rh = fh / rows;
    for (let c = 0; c < cols; c++) {
      const x = fx + (c + 0.5) * cw;
      const hc = H0 + ((c + 0.5) / cols) * (H1 - H0);
      const ridge = (mg[c] / yMax) * rows;
      const slope = ((mg[Math.min(cols - 1, c + 1)] - mg[Math.max(0, c - 1)]) / yMax) * rows;
      const light = clamp(0.62 + slope * 1.1, 0.22, 1);
      // Blue is the drink arriving: its share of the ridge while it absorbs, gone within about two hours.
      const since = active ? hc - active.x : -1;
      const share = since > 0 && mg[c] > 0.5 ? clamp((active.mg * unit(since)) / mg[c], 0, 1) * clamp((2.2 - since) / 0.8, 0, 1) : 0;
      for (let r = 0; r < rows; r++) {
        const y = base - (r + 0.5) * rh;
        if (r + 0.5 > ridge + 0.5) {
          if (r < ridge + 5) near.push(x - 0.5, y - 0.5);
          else if ((r + c) % 2 === 0 && r > ridge) far.push(x - 0.5, y - 0.5);
          continue;
        }
        const depth = clamp((r + 0.5) / Math.max(ridge, 1), 0, 1);
        const edge = clamp(ridge - r + 0.5, 0, 1);
        const val = clamp(depth ** 1.5 * light * edge * (0.45 + 0.55 * Math.sqrt(clamp(ridge / rows, 0, 1))), 0, 1);
        if (val < 0.015) continue;
        const rad = pitch * (0.1 + 0.36 * Math.sqrt(val));
        if (share > 0.02 && depth > 1 - share) blues.push(x, y, rad * (0.8 + 0.3 * val));
        else buckets[Math.min(LEVELS - 1, (val * LEVELS * 1.05) | 0)].push(x, y, rad);
      }
    }
    ctx.fillStyle = '#242424';
    ctx.beginPath(); for (let n = 0; n < near.length; n += 2) ctx.rect(near[n], near[n + 1], 1, 1); ctx.fill();
    ctx.fillStyle = '#171717';
    ctx.beginPath(); for (let n = 0; n < far.length; n += 2) ctx.rect(far[n], far[n + 1], 1, 1); ctx.fill();
    for (let l = 0; l < LEVELS; l++) if (buckets[l].length) { ctx.fillStyle = greys[l]; paint(buckets[l]); }
    if (blues.length && active) { ctx.fillStyle = C.accent; ctx.globalAlpha = active.a; paint(blues); ctx.globalAlpha = 1; }

    // Sleep line.
    const lineY = Math.round(base - (LINE / yMax) * fh) + 0.5;
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(fx, lineY); ctx.lineTo(fx + fw, lineY); ctx.stroke();
    ctx.setLineDash([]);
    if (!small) { text(`${LINE} MG`, fx + fw + 10, lineY + 3, C.mid); text('ROUGH SLEEP LINE', fx + fw + 10, lineY + 16, C.dim); }
    else text(`${LINE} MG`, fx + fw, lineY - 6, C.mid, 10, 400, 'right');

    // Time axis.
    const axisY = base + 6.5;
    ctx.strokeStyle = C.faint;
    ctx.beginPath(); ctx.moveTo(fx, axisY); ctx.lineTo(fx + fw, axisY); ctx.stroke();
    ctx.strokeStyle = C.dim;
    for (let h = H0; h <= H1; h += 3) {
      const x = Math.round(xAt(h)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, axisY); ctx.lineTo(x, axisY + 4); ctx.stroke();
      if (!small || (h - H0) % 6 === 0) text(clock(h).slice(0, 2), x, axisY + 52, C.dim, 10, 400, 'center');
    }

    // Drinks sit in a lane under the axis, tied to the ridge by a dotted line.
    const hovering = !grabbed && p.inside ? nearestCup() : null;
    for (const c of cups) {
      const x = Math.round(xAt(c.x)) + 0.5;
      const top = base - (at(c.x + 1) / yMax) * fh;
      const blue = c.a > 0.5;
      ctx.strokeStyle = blue ? C.accent : C.dim;
      ctx.setLineDash([1, 3]);
      ctx.beginPath(); ctx.moveTo(x, axisY + 8); ctx.lineTo(x, Math.max(top, fy)); ctx.stroke();
      ctx.setLineDash([]);
      const big = c === grabbed || c === hovering;
      ctx.fillStyle = blue ? C.accent : big || c === selected ? C.white : C.ink;
      ctx.beginPath(); ctx.arc(x, axisY + 16, big || c === selected ? 5 : 4, 0, 6.2832); ctx.fill();
      if (blue || big || c === selected) text(clock(c.x), x, axisY + 32, blue ? C.accent : C.ink, 10, 400, 'center');
    }

    // Bedtime, draggable, with what is left.
    const bedX = Math.round(xAt(bed.x)) + 0.5;
    const left = at(bed.x);
    const ly = fy - (small ? 8 : 18);
    const bedHot = grabbed === bed || (!grabbed && p.inside && !hovering && onBed());
    ctx.strokeStyle = bedHot ? C.white : C.mid;
    ctx.beginPath(); ctx.moveTo(bedX, base + 2); ctx.lineTo(bedX, ly + 5); ctx.stroke();
    const bed1 = `BED ${clock(bed.x)}`, bed2 = `${Math.round(left)} MG STILL IN YOU`;
    const wide = (str, weight) => { ctx.font = `${weight} 10px ${MONO}`; return ctx.measureText(str).width; };
    const bedW = Math.max(wide(bed1, 500), wide(bed2, 400));
    // While opening or closing, the label takes the side it ends on, right away.
    let flip = bedX + 6 + bedW > G.ox + G.W - 12;
    if (morph) {
      morph.endG ??= layout(morph.to, morph.lock);
      const E = morph.endG, endX = E.fx + ((bed.x - H0) / (H1 - H0)) * E.fw;
      flip = endX + 6 + bedW > E.ox + E.W - 12;
    }
    const bx = flip ? bedX - 6 : bedX + 6, al = flip ? 'right' : 'left';
    const bedBox = flip ? [bx - bedW, bx] : [bx, bx + bedW];
    text(bed1, bx, ly - (small ? 8 : 12), C.white, 10, 500, al);
    text(bed2, bx, ly + (small ? 4 : 2), left > LINE ? C.ink : C.mid, 10, 400, al);

    // Peak.
    const peakX = Math.round(xAt(peakAt)) + 0.5;
    const peak1 = `PEAK ${Math.round(peak)} MG`, peakW = Math.max(wide(peak1, 500), wide(clock(peakAt), 400));
    const clear = (a, b) => a > G.ox + 4 && b < G.ox + G.W - 4 && (b + 16 < bedBox[0] || a - 16 > bedBox[1]) && Math.abs(peakX - bedX) > 8;
    const peakSide = peak <= 1 ? null : clear(peakX + 6, peakX + 6 + peakW) ? 'left' : clear(peakX - 6 - peakW, peakX - 6) ? 'right' : null;
    if (peakSide && openness > 0 && !morph?.closing) {
      // The peak is a full-view detail: it fades with the morph, like the editor.
      ctx.globalAlpha = openness;
      const peakY = base - (peak / yMax) * fh;
      const px = peakSide === 'left' ? peakX + 6 : peakX - 6;
      ctx.strokeStyle = C.dim;
      ctx.beginPath(); ctx.moveTo(peakX, peakY - 4); ctx.lineTo(peakX, ly + 5); ctx.stroke();
      text(peak1, px, ly - (small ? 8 : 12), C.ink, 10, 500, peakSide);
      text(clock(peakAt), px, ly + (small ? 4 : 2), C.mid, 10, 400, peakSide);
      ctx.globalAlpha = 1;
    }

    // Reading under the pointer (not on touch: a finger covers it).
    if (p.inside && !p.touch && !grabbed && !hovering && !bedHot && p.x > fx && p.x < fx + fw && p.y > fy - 30 && p.y < axisY + 30) {
      const h = timeAt(p.x), v = at(h);
      const x = Math.round(p.x) + 0.5, ry = base - (v / yMax) * fh;
      ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.arc(x, ry, 2.5, 0, 6.2832); ctx.fill();
      const right = p.x < fx + fw - 130;
      ctx.fillStyle = C.bg;
      ctx.fillRect(right ? x + 6 : x - 106, ry - 20, 100, 14);
      text(`${clock(h)} · ${Math.round(v)} MG`, right ? x + 8 : x - 8, ry - 9, C.white, 10, 400, right ? 'left' : 'right');
    }

    // Header, and the decision it is for.
    const total = cups.reduce((n, c) => n + doseOf(c.drink, c.ml), 0);
    const hx = G.ox + PAD, hy = G.oy + PAD + 8;
    text('CAFFEINE', hx, hy, C.white, 11, 500);
    text(`${cups.length} ${cups.length === 1 ? 'DRINK' : 'DRINKS'} · ${Math.round(total)} MG · HALF-LIFE ${HALF_LIFE}H`, hx, hy + 15, C.mid);
    let advice = 'NOTHING TODAY';
    if (cups.length) {
      const lastCup = cups.reduce((a, b) => (b.target > a.target ? b : a));
      const rest = cups.filter((c) => c !== lastCup);
      const base0 = at(bed.x, rest), dose = doseOf(lastCup.drink, lastCup.ml);
      if (base0 >= LINE) advice = 'OVER THE LINE EVEN WITHOUT THE LAST DRINK';
      else {
        let lo = H0, hi = bed.x;
        for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (base0 + dose * unit(bed.x - m) <= LINE && m < bed.x - 1.1) lo = m; else hi = m; }
        advice = lo <= H0 + 0.01 ? 'NO ROOM FOR IT TODAY' : `LAST ${DRINK[lastCup.drink].name.toUpperCase()} BY ${clock(Math.floor(lo * 4) / 4)}`;
      }
    }
    const rx = G.ox + G.W - PAD - (widget ? 56 * openness : 0);
    if (!small) { text(advice, rx, hy, C.ink, 10, 400, 'right'); text(`TO BE UNDER ${LINE} MG AT BED`, rx, hy + 15, C.mid, 10, 400, 'right'); }
    else if (!widget || openness > 0) {
      // Small screens: a third header line, left out of the closed widget.
      ctx.globalAlpha = openness;
      text(advice, hx, hy + 34, C.ink);
      ctx.globalAlpha = 1;
    }

    el.style.cursor = grabbed ? 'grabbing' : hovering || bedHot ? 'grab' : 'default';

    // Keep the URL in step once someone has changed something.
    if (hash && touched && !grabbed) {
      const h = [...cups].sort((a, b) => a.target - b.target).map((c) => `${c.drink}.${c.ml}.${hhmm(c.target)}`).join('_') + `~bed.${hhmm(bed.target)}`;
      if (h !== lastHash) { lastHash = h; try { history.replaceState(null, '', `#${h}`); } catch {} }
    }
  }

  // ── Widget: a small card that opens into the full tool ──
  // The card's rectangle grows to the viewport (clip-path) and the chart is
  // laid out inside that same rectangle every frame, on the same curve, so
  // the dots, axis and labels grow with it. A still of the old view fades
  // over the first frames to cover the switch between the small and large
  // label rules. Close plays the same thing back into the card.
  let open = () => {}, close = () => {};
  if (widget) {
    root.classList.add('cd-widget');
    root.tabIndex = 0;
    root.setAttribute('role', 'button');
    root.setAttribute('aria-label', 'Open Caffeine Day');
    const holder = document.createElement('div');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
    const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const OPEN_MS = 460, CLOSE_MS = 400;
    let busy = false;
    const clipOf = (r, rad) => `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round ${rad}px)`;
    const FULL = 'inset(0px 0px 0px 0px round 0px)';
    const still = (r, radius) => {
      const c = document.createElement('canvas');
      c.width = el.width; c.height = el.height;
      c.getContext('2d').drawImage(el, 0, 0);
      c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;z-index:1001;border-radius:${radius}px`;
      document.body.appendChild(c);
      c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-out', fill: 'forwards' }).finished.then(() => c.remove(), () => c.remove());
    };
    const lockOf = (g) => ({ small: g.small, cols: g.cols, rows: g.rows });
    const closeBtn = () => root.querySelector('.cd-close');
    const setOpen = (on) => {
      root.classList.toggle('cd-open', on);
      if (on) { root.removeAttribute('role'); root.removeAttribute('aria-label'); root.tabIndex = -1; }
      else { root.tabIndex = 0; root.setAttribute('role', 'button'); root.setAttribute('aria-label', 'Open Caffeine Day'); }
      fit();
    };

    open = () => {
      if (root.classList.contains('cd-open') || busy) return;
      busy = true;
      const card = root.getBoundingClientRect();
      const was = geo.small, smallRect = el.getBoundingClientRect();
      holder.style.cssText = `width:${card.width}px;height:${card.height}px;flex:none`;
      root.before(holder);
      setOpen(true);
      const big = el.getBoundingClientRect();
      if (!reduce.matches && was !== geo.small) still(smallRect, 20);
      let main;
      if (reduce.matches) main = root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
      else {
        morph = { from: { x: card.left - big.left, y: card.top - big.top, w: card.width, h: card.height }, to: { x: 0, y: 0, w: s.w, h: s.h }, t0: performance.now(), dur: OPEN_MS, closing: false, lock: lockOf(geo), e: 0 };
        draw(0);
        main = root.animate([{ clipPath: clipOf(card, 20) }, { clipPath: FULL }], { duration: OPEN_MS, easing: EASE });
        root.querySelector('.cd-panel').animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 340, delay: 200, easing: OUT, fill: 'backwards' });
        closeBtn().animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 260, easing: 'ease-out', fill: 'backwards' });
      }
      const done = () => { morph = null; busy = false; el.focus({ preventScroll: true }); };
      main.finished.then(done, done);
    };

    close = () => {
      if (!root.classList.contains('cd-open') || busy) return;
      busy = true;
      const big = el.getBoundingClientRect(), card = holder.getBoundingClientRect();
      const finish = () => {
        morph = null;
        root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        setOpen(false);
        holder.remove();
        busy = false;
        root.focus({ preventScroll: true });
      };
      if (reduce.matches) { root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-out', fill: 'forwards' }).finished.then(finish, finish); return; }
      const target = layout({ x: 0, y: 0, w: card.width, h: card.height });
      const to = { x: card.left - big.left, y: card.top - big.top, w: card.width, h: card.height };
      if (target.small !== geo.small) {
        // Redraw the full view as it looks once Close is pressed (no peak,
        // bedtime already on the side it ends on), then fade that still out.
        morph = { from: { x: 0, y: 0, w: s.w, h: s.h }, to: { x: 0, y: 0, w: s.w, h: s.h }, t0: -1e9, dur: 1, closing: true, lock: lockOf(geo), e: 0, endG: layout(to, lockOf(target)) };
        draw(0);
        still(big, 0);
      }
      morph = { from: { x: 0, y: 0, w: s.w, h: s.h }, to, t0: performance.now(), dur: CLOSE_MS, closing: true, lock: lockOf(target), e: 0 };
      draw(0);
      root.querySelector('.cd-panel').animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px)' }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
      closeBtn().animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
      root.animate([{ clipPath: FULL }, { clipPath: clipOf(card, 20) }], { duration: CLOSE_MS, easing: EASE, fill: 'forwards' }).finished.then(finish, finish);
    };

    root.addEventListener('click', (e) => { if (!root.classList.contains('cd-open') && !e.target.closest('.cd-close')) open(); });
    root.addEventListener('keydown', (e) => {
      if (!root.classList.contains('cd-open') && (e.key === 'Enter' || e.key === ' ') && e.target === root) { e.preventDefault(); open(); }
    });
    closeBtn().addEventListener('click', (e) => { e.stopPropagation(); close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  return { open: () => open(), close: () => close(), destroy() { alive = false; root.innerHTML = ''; } };
}
