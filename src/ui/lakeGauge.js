// The lake gauge: Truth Debt shown as Lake Ulysses' water quality — a
// landscape TDS chart (clean blue → swamp green, discrete bands like a real
// water-test chart) with a live reading, and a tamagotchi fish tank in the
// corner. It replaces the old "DEBT N" box.
//
// Deliberately indifferent: a sensor readout with clinical labels, no
// sympathy and no judgment words. The fish are the one soft touch — a
// mascot someone at the county thought the data needed — and even they
// just report: thriving, sluggish, sick, belly-up. See engine/lake.js for
// the numbers and why the bands line up with the endings.
import { LAKE_COLORS, PPM_TICKS, ppmFor, statusFor, fishStageFor, colorFor } from '../engine/lake.js';

const PPM_MAX = 520;

// 8×5 pixel fish facing right: X = body, E = eye.
const FISH_ROWS = [
  '...XXX..',
  'X.XXXXX.',
  'XXXXXXEX',
  'X.XXXXX.',
  '...XXX..',
];

// Per stage: how many fish are left, what color they've gone, and whether
// the tank still has bubbles in it.
const STAGES = [
  { count: 3, body: '#ff9f1c', eye: '#000', bubbles: true },   // thriving
  { count: 2, body: '#f0b04a', eye: '#000', bubbles: true },   // fine
  { count: 2, body: '#b9c25e', eye: '#000', bubbles: false },  // sluggish
  { count: 1, body: '#cbd86a', eye: '#000', bubbles: false },  // sick
  { count: 1, body: '#c9d46a', eye: '#f4f4d0', bubbles: false }, // belly-up
];

function fishSvg(body, eye) {
  const rects = [];
  FISH_ROWS.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === 'X') rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${body}"/>`);
      if (c === 'E') rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${eye}"/>`);
    });
  });
  return `<svg class="dx-fish__svg" viewBox="0 0 8 5" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

export function createLakeGauge(initialDebt = 0, { large = false } = {}) {
  const el = document.createElement('div');
  el.className = `dx-lake${large ? ' dx-lake--large' : ''}`;
  el.setAttribute('role', 'img');

  const tank = document.createElement('div');
  tank.className = 'dx-lake__tank';

  const chart = document.createElement('div');
  chart.className = 'dx-lake__chart';
  chart.innerHTML = `
    <div class="dx-lake__head">
      <span class="dx-lake__title">LAKE ULYSSES · TDS</span>
      <span class="dx-lake__reading"></span>
    </div>
    <div class="dx-lake__bar">
      ${LAKE_COLORS.map((c) => `<span class="dx-lake__band" style="background:${c}"></span>`).join('')}
      <span class="dx-lake__marker"></span>
    </div>
    <div class="dx-lake__ticks">
      ${PPM_TICKS.map((p) => `<span style="left:${(p / PPM_MAX) * 100}%">${p === 500 ? '500+' : p}</span>`).join('')}
    </div>
  `;

  el.append(tank, chart);
  const reading = chart.querySelector('.dx-lake__reading');
  const marker = chart.querySelector('.dx-lake__marker');

  let lastStage = null;

  function renderTank(debt) {
    const stageIndex = fishStageFor(debt);
    tank.style.setProperty('--water', colorFor(debt));
    tank.dataset.stage = String(stageIndex);
    if (stageIndex === lastStage) return;
    lastStage = stageIndex;

    const stage = STAGES[stageIndex];
    const parts = [];
    for (let i = 0; i < stage.count; i++) {
      parts.push(`<span class="dx-fish dx-fish--${i}">${fishSvg(stage.body, stage.eye)}</span>`);
    }
    if (stage.bubbles) {
      parts.push('<span class="dx-bubble dx-bubble--0"></span><span class="dx-bubble dx-bubble--1"></span>');
    }
    parts.push('<span class="dx-lake__murk"></span>');
    tank.innerHTML = parts.join('');
  }

  function update(debt) {
    const ppm = ppmFor(debt);
    const status = statusFor(debt);
    reading.textContent = `${ppm} ppm · ${status}`;
    marker.style.left = `${(ppm / PPM_MAX) * 100}%`;
    el.setAttribute('aria-label', `Lake Ulysses water quality: ${ppm} parts per million, ${status}`);
    renderTank(debt);
  }

  update(initialDebt);
  return { el, update };
}
