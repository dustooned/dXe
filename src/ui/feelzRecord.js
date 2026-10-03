// The player's final record: everything the chapter tracked, consolidated
// into one tight document. Two renderings of the same data:
//   createFaxPrintout()  on screen, printed line by line like a fax coming in
//   renderRecordPng()    a printable "official" FEELZ document, as a PNG
// with a footer of lore about the company behind the app. PLACEHOLDER lore.
import { EMOTIONS, EMOTION_ORDER } from '../engine/loadout.js';
import { ppmFor, statusFor } from '../engine/lake.js';
import { isTrusted } from '../engine/trust.js';
import { buildReport } from './feelzReport.js';
import { iconHtml } from './feelingIcons.js';
import { playFaxHandshake, playFaxLine, playFaxJam } from '../shell/audio.js';

export const COMPANY = 'Halberd & Lowe Affective Systems';
export const LORE = [
  `FEELZ is provided to residents of Lake Ulysses at no cost by ${COMPANY}, under Municipal Wellness Agreement LU-77, ratified by the Lake Ulysses City Council (Councilman B. Baiter, presiding).`,
  'Readings are drawn from county lake sensors, and from you.',
  'Records are retained for the life of the lake. By reading this record you consent to having read it.',
  'The lake remembers.',
];

const NPCS = ['THERAPIST', 'DEBORAH', 'RWANDA', 'SAMUN', 'RICK'];

function fileNumber(state) {
  // Stable per run: derived from what happened, not the clock.
  const seed = JSON.stringify(state.choices ?? {}) + (state.loadout ?? '');
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(h % 1000000).padStart(6, '0');
}

export function buildRecord(state, ending) {
  const r = buildReport(state);
  const debt = state.truthDebt ?? 0;
  const lieNodes = Object.entries(state.choices ?? {}).filter(([, s]) => s === 'lie');
  const liedTo = new Set(lieNodes.map(([n]) => n.split('_')[0])).size;
  const trusted = NPCS.filter((n) => n !== 'THERAPIST' && isTrusted(state.bonds?.[n]));
  return {
    file: `FP-${fileNumber(state)}`,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase(),
    profile: `${r.diagnosis.name} (${r.diagnosis.code})`,
    summary: r.diagnosis.summary,
    lake: `${ppmFor(debt)} ppm · ${statusFor(debt)}`,
    said: [`Water too high: ${state.checkIn?.water ?? '—'}`, `Told someone "fine": ${state.checkIn?.fine ?? '—'}`],
    record: lieNodes.length ? `${lieNodes.length} lies, to ${liedTo} ${liedTo === 1 ? 'person' : 'people'}` : 'No lies recorded',
    collected: r.collected,
    counts: r.counts,
    led: r.dominant ?? null,
    disclosure: Object.entries(r.people).map(([who, p]) => `${who.toUpperCase()} ${p.truth}/${p.lie}`).join('  '),
    trusted: trusted.length ? trusted.join(', ') : 'NO ONE',
    note: r.note,
    outcome: ending?.title ?? '—',
  };
}

// The record as rows: [label, value] (value null = a rule line).
function rows(rec) {
  return [
    ['FILE', `${rec.file} · ${rec.date}`],
    ['CLIENT', '[REDACTED]'],
    ['CLINICIAN', 'C. BROWNING, LCSW'],
    null,
    ['PROFILE', rec.profile],
    ['', rec.summary],
    null,
    ['LAKE', rec.lake],
    ['SELF-REPORT', rec.said[0]],
    ['', rec.said[1]],
    ['RECORDED', rec.record],
    null,
    ['FEELINGS', `${rec.collected.length}/8${rec.led ? ` · led with ${rec.led}` : ''}`],
    ['FEELINGS_ICONS', ''],
    ['DISCLOSED', rec.disclosure || '—'],
    ['TRUSTED YOU', rec.trusted],
    ['CASE NOTE', rec.note],
    null,
    ['OUTCOME', rec.outcome],
  ];
}

// ── On screen: the fax ─────────────────────────────────────────────────────
// The machine itself, as pixel art: a grey body, a dark paper slot, a green
// status light that blinks while it prints. '#' body, '=' slot, 'o' light,
// '-' shadow.
const PRINTER = [
  '..##########################################..',
  '.############################################.',
  '##############################################',
  '####==================================####oo##',
  '####==================================####oo##',
  '##############################################',
  '.--------------------------------------------.',
];
function printerSvg() {
  const colors = { '#': '#6d6d78', '=': '#121216', o: '#3bd16f', '-': '#3a3a42' };
  let cells = '';
  PRINTER.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[ch]}"${ch === 'o' ? ' class="dx-fax__led"' : ''}/>`;
  }));
  return `<svg viewBox="0 0 ${PRINTER[0].length} ${PRINTER.length}" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
}

// A chunky pixel arrow for "pull it down" (flipped for "back to the top").
const ARROW_SVG = '<svg viewBox="0 0 7 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="7" height="1"/><rect x="1" y="1" width="5" height="1"/><rect x="2" y="2" width="3" height="1"/><rect x="3" y="3" width="1" height="1"/></svg>';

// How long each line takes to print, and how fast once the paper's pulled.
const LINE_MS = 340;
const STAMP_MS = 700;
const RUSH_MS = 45;
// A slot at the top, paper feeding down out of it, one line per tick with
// a dot-matrix chirp, a RECEIVED stamp at the end. `onDone` when printed.
export function createFaxPrintout(rec, { onDone } = {}) {
  const el = document.createElement('div');
  el.className = 'dx-fax';
  el.innerHTML = `<div class="dx-fax__printer">${printerSvg()}</div><div class="dx-fax__paper"><div class="dx-fax__feed"></div></div><button type="button" class="dx-fax__more" aria-label="Pull the paper down" hidden>${ARROW_SVG}</button>`;
  const paper = el.querySelector('.dx-fax__paper');
  const feed = el.querySelector('.dx-fax__feed');

  const lines = [];
  const head = document.createElement('div');
  head.className = 'dx-fax__head';
  head.innerHTML = '<span class="dx-fax__logo">FEELZ</span><span class="dx-fax__kind">AFFECTIVE RECORD</span>';
  lines.push(head);
  for (const row of rows(rec)) {
    const line = document.createElement('div');
    if (!row) { line.className = 'dx-fax__rule'; lines.push(line); continue; }
    const [label, value] = row;
    if (label === 'FEELINGS_ICONS') {
      line.className = 'dx-fax__icons';
      for (const name of EMOTION_ORDER) {
        const has = rec.collected.includes(name);
        const chip = document.createElement('span');
        chip.className = has ? 'dx-fax__chip' : 'dx-fax__chip is-missing';
        chip.innerHTML = has ? `${iconHtml(name)}${rec.counts[name] ?? 0}` : '·';
        if (has) chip.style.color = EMOTIONS[name].color;
        line.appendChild(chip);
      }
    } else {
      line.className = 'dx-fax__row';
      const l = document.createElement('span');
      l.className = 'dx-fax__label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'dx-fax__value';
      v.textContent = value;
      line.append(l, v);
    }
    lines.push(line);
  }
  const stamp = document.createElement('div');
  stamp.className = 'dx-fax__stamp';
  stamp.textContent = 'RECEIVED · LAKE ULYSSES';
  const fine = document.createElement('p');
  fine.className = 'dx-fax__fine';
  fine.textContent = LORE.join(' ');
  lines.push(fine, stamp);

  let i = 0;
  let timer = null;
  let rushed = false;
  let done = false;
  // One line at a time: the print head sweeps across it (CSS, --print-ms)
  // while the dot-matrix chirps. Once rushed, lines rip out fast and come
  // out smeared, like the paper was pulled.
  function next() {
    if (i >= lines.length) {
      done = true;
      el.classList.remove('is-printing');
      paper.scrollTop = 0;
      syncArrow();
      onDone?.();
      return;
    }
    const line = lines[i++];
    const ms = rushed ? RUSH_MS : line === stamp ? STAMP_MS : LINE_MS;
    line.style.setProperty('--print-ms', `${ms}ms`);
    line.classList.add('is-printing');
    if (rushed && line !== stamp) line.classList.add('is-smeared');
    feed.appendChild(line);
    paper.scrollTop = paper.scrollHeight;
    if (!rushed || i % 3 === 0) playFaxLine(line === stamp);
    timer = setTimeout(next, ms);
  }
  // The handshake screech, then the paper starts feeding.
  el.classList.add('is-printing');
  const lead = playFaxHandshake();
  timer = setTimeout(next, lead);

  // Reading it once it's printed: no scrollbar. Drag the paper down (pull
  // it out of the machine) to read on, or tap the arrow to ease it down to
  // the next section; at the end the arrow flips and takes you back up.
  const more = el.querySelector('.dx-fax__more');
  let easing = null;
  function easeTo(target) {
    cancelAnimationFrame(easing);
    const from = paper.scrollTop;
    const to = Math.max(0, Math.min(target, paper.scrollHeight - paper.clientHeight));
    const t0 = performance.now();
    const dur = 650;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      paper.scrollTop = from + (to - from) * (1 - Math.pow(1 - p, 3));
      if (p < 1) easing = requestAnimationFrame(step);
      else { easing = null; syncArrow(); }
    };
    easing = requestAnimationFrame(step);
  }
  function atBottom() {
    return paper.scrollTop + paper.clientHeight >= paper.scrollHeight - 4;
  }
  function syncArrow() {
    if (!done) return;
    const scrolls = paper.scrollHeight > paper.clientHeight + 4;
    more.hidden = !scrolls;
    more.classList.toggle('is-up', atBottom());
  }
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    if (atBottom()) { easeTo(0); return; }
    // The next section: the first rule line below the current view.
    const view = paper.scrollTop + 8;
    const rules = [...feed.querySelectorAll('.dx-fax__rule, .dx-fax__fine')].map((r) => r.offsetTop);
    const next = rules.find((top) => top > view + 4);
    easeTo(next ?? paper.scrollHeight);
  });
  let drag = null;
  paper.addEventListener('pointerdown', (e) => {
    if (!done) return;
    drag = { y: e.clientY, top: paper.scrollTop, moved: false };
    paper.setPointerCapture?.(e.pointerId);
  });
  paper.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 4) drag.moved = true;
    // Pulling down draws more paper out: the text moves up toward the slot.
    paper.scrollTop = drag.top + dy;
    syncArrow();
  });
  const endDrag = (e) => {
    if (drag?.moved) e.stopPropagation();
    drag = null;
  };
  paper.addEventListener('pointerup', endDrag);
  paper.addEventListener('pointercancel', endDrag);
  paper.addEventListener('scroll', () => { if (!easing) syncArrow(); });

  // Tap: pull the paper. The motor jams and grinds, the rest prints in a
  // rush, and a faint scratch is left on the paper where it dragged.
  function rush() {
    if (rushed || done) return;
    rushed = true;
    playFaxJam();
    el.classList.add('is-jammed');
    const scratch = document.createElement('div');
    scratch.className = 'dx-fax__scratch';
    scratch.style.top = `${feed.scrollHeight - 10}px`;
    feed.appendChild(scratch);
    if (i === 0) { clearTimeout(timer); timer = setTimeout(next, 120); }
  }

  return {
    el,
    rush,
    finish() { clearTimeout(timer); while (i < lines.length) feed.appendChild(lines[i++]); done = true; paper.scrollTop = 0; syncArrow(); onDone?.(); },
    destroy() { clearTimeout(timer); cancelAnimationFrame(easing); el.remove(); },
  };
}

// ── The printable document (PNG) ───────────────────────────────────────────
const W = 1275; // 8.5in at 150dpi
const H = 1650; // 11in
const INK = '#1d1d22';
const PAPER = '#f4f1e8';

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-feelz-${name.toLowerCase()}`).trim() || '#888';
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

// The FEELZ wheel, eight slices; the ones you collected in color.
function drawWheel(ctx, cx, cy, r, collected) {
  const step = (Math.PI * 2) / 8;
  const start = -Math.PI / 2 - Math.PI / 8;
  EMOTION_ORDER.forEach((name, i) => {
    const a0 = start + i * step + 0.04;
    const a1 = start + (i + 1) * step - 0.04;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.arc(cx, cy, r * 0.42, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = collected.includes(name) ? cssColor(name) : '#cfcabd';
    ctx.fill();
  });
}

export async function renderRecordPng(rec) {
  try { await Promise.all([document.fonts.load('28px "VT323"'), document.fonts.load('40px "Press Start 2P"')]); } catch { /* fallback fonts */ }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Watermark: a huge faint wheel.
  ctx.globalAlpha = 0.06;
  drawWheel(ctx, W / 2, H * 0.55, 420, EMOTION_ORDER);
  ctx.globalAlpha = 1;

  // Letterhead.
  drawWheel(ctx, 140, 140, 70, rec.collected);
  ctx.font = '56px "Press Start 2P", monospace';
  const letters = [['F', 'Anger'], ['E', 'Happy'], ['E', 'Trust'], ['L', 'Sadness'], ['Z', 'Anxiety']];
  let x = 240;
  for (const [ch, feel] of letters) { ctx.fillStyle = cssColor(feel); ctx.fillText(ch, x, 150); x += ctx.measureText(ch).width + 6; }
  ctx.fillStyle = INK;
  ctx.font = '30px "VT323", monospace';
  ctx.fillText(`AFFECTIVE SERVICES · ${COMPANY.toUpperCase()}`, 240, 192);
  ctx.fillText('A MUNICIPAL WELLNESS PARTNER OF THE CITY OF LAKE ULYSSES', 240, 222);
  ctx.fillRect(80, 252, W - 160, 4);
  ctx.font = '44px "VT323", monospace';
  ctx.fillText('AFFECTIVE RECORD · CERTIFIED COPY', 80, 312);

  // Body rows.
  let y = 370;
  const labelX = 80;
  const valueX = 360;
  const maxW = W - valueX - 90;
  for (const row of rows(rec)) {
    if (!row) { ctx.fillStyle = '#9a958a'; ctx.fillRect(80, y - 18, W - 160, 2); y += 22; continue; }
    const [label, value] = row;
    if (label === 'FEELINGS_ICONS') {
      ctx.font = '28px "VT323", monospace';
      let ix = valueX;
      for (const name of EMOTION_ORDER) {
        const has = rec.collected.includes(name);
        ctx.fillStyle = has ? cssColor(name) : '#bdb7aa';
        ctx.fillRect(ix, y - 22, 22, 22);
        ctx.fillStyle = INK;
        ctx.fillText(has ? `${name.slice(0, 3).toUpperCase()} ${rec.counts[name] ?? 0}` : '···', ix + 28, y - 3);
        ix += 100;
      }
      y += 40;
      continue;
    }
    ctx.fillStyle = INK;
    ctx.font = '30px "VT323", monospace';
    ctx.fillText(label, labelX, y);
    const lines = wrap(ctx, value, maxW);
    for (const l of lines) { ctx.fillText(l, valueX, y); y += 32; }
    y += 6;
  }

  // Signatures and the city's seal.
  y = Math.max(y + 30, 1240);
  ctx.fillStyle = INK;
  ctx.fillRect(80, y, 380, 2);
  ctx.fillRect(560, y, 380, 2);
  ctx.font = '26px "VT323", monospace';
  ctx.fillText('C. BROWNING, LCSW · CLINICIAN OF RECORD', 80, y + 30);
  ctx.fillText('B. BAITER · CITY COUNCIL', 560, y + 30);
  ctx.save();
  ctx.translate(1080, y - 40);
  ctx.rotate(-0.18);
  ctx.strokeStyle = '#b3261e';
  ctx.fillStyle = '#b3261e';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 74, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '22px "VT323", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CITY OF', 0, -22);
  ctx.fillText('LAKE ULYSSES', 0, 2);
  ctx.fillText('APPROVED', 0, 30);
  ctx.restore();
  ctx.textAlign = 'left';

  // Lore, small print.
  ctx.fillStyle = '#4a4740';
  ctx.font = '24px "VT323", monospace';
  let ly = y + 90;
  for (const para of LORE) {
    for (const l of wrap(ctx, para, W - 160)) { ctx.fillText(l, 80, ly); ly += 26; }
    ly += 6;
  }
  ctx.fillText(`DOCUMENT ${rec.file}-LU77 · PAGE 1 OF 1 · DO NOT IMMERSE`, 80, H - 50);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export async function downloadRecordPng(rec) {
  const blob = await renderRecordPng(rec);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FEELZ_record_${rec.file}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
