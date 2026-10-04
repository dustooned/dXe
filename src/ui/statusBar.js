// The four meters, as the FEELZ phone's status bar — readable at a glance
// the way anyone already reads their phone:
//
//   carrier  "FEELZ 5G" → LTE → E → No Service, by Truth Debt (the lake)
//   clock    Integrity: honest play keeps time; as it drops the minutes
//            glitch and skip, and near the bottom the clock can't hold
//   signal   Trust: bars, how connected people feel to you
//   wifi     Lucidity: arcs, how clearly you're seeing
//   battery  Stability: charge; red at 2 or below
//
// Extras: `typing` shows a notification dot (IT/SO about to say something),
// `airplane` greys everything out with ✈ (an NPC has shut you out).
// Same contract as the old meter group: { el, destroy }.
//
// The icons are lo-fi pixel sprites (hard-edged SVG cells, no curves).
// When a meter moves, its icon pops (up: a bright pulse; down: a flicker),
// a word under the bar says what moved ("▲ connected"), and a two-note
// blip rises or falls, pitched per meter so each is learnable by ear.
// `quiet` (meters not revealed yet) records the values without any of it.
import { playMeterChange } from '../shell/audio.js';

// What each meter means, in the therapist's words.
const WORDS = { integrity: 'honest', trust: 'connected', lucidity: 'clear', stability: 'steady' };
// The values the last status bar showed — this bar is rebuilt every render,
// so change is measured against whatever the previous one displayed.
let lastSeen = null;

// A pixel sprite from rows of characters: '.' is empty, a digit is a cell
// that lights when the level is at least that digit (0 = always lit).
function sprite(rows, level, cls) {
  const h = rows.length;
  const w = rows[0].length;
  let cells = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const on = level >= Number(ch);
      cells += `<rect x="${x}" y="${y}" width="1" height="1" class="${on ? 'is-on' : 'is-off'}"/>`;
    });
  });
  return `<svg class="dx-status__px ${cls}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
}

// Four stepped bars.
const SIGNAL = [
  '.........44',
  '.........44',
  '......33.44',
  '......33.44',
  '...22.33.44',
  '...22.33.44',
  '11.22.33.44',
  '11.22.33.44',
];
// Three stepped arcs and a dot.
const WIFI = [
  '..3333333..',
  '.3.......3.',
  '3..22222..3',
  '..2.....2..',
  '...11111...',
  '..1.....1..',
  '.....1.....',
  '.....1.....',
];
// Outline and nub always lit; five cells of charge.
const BATTERY = [
  '00000000000000.',
  '0............00',
  '0.11.22.33.4.00',
  '0.11.22.33.4.00',
  '0.11.22.33.4.00',
  '0.11.22.33.4.00',
  '0............00',
  '00000000000000.',
];
// Four cells of charge; the level runs 0..4 from stability 0..10.

function carrierFor(debt) {
  if (debt <= 2) return 'FEELZ 5G';
  if (debt <= 5) return 'FEELZ LTE';
  if (debt <= 7) return 'FEELZ E';
  return 'No Service';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// `hidden`: meters not introduced yet (the tutorial names them one by one);
// they stay invisible, and silent, until reveal(meter).
export function createStatusBar(stats, { typing = false, airplane = false, quiet = false, hidden = [] } = {}) {
  const integrity = stats.integrity ?? 0;
  const trust = stats.trust ?? 0;
  const lucidity = stats.lucidity ?? 0;
  const stability = stats.stability ?? 0;
  const debt = stats.truthDebt ?? 0;

  const el = document.createElement('div');
  el.className = `dx-status${airplane ? ' is-airplane' : ''}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Integrity ${integrity}, trust ${trust}, lucidity ${lucidity}, stability ${stability} of 10`);

  el.innerHTML = `
    <span class="dx-status__carrier">${airplane ? '✈' : carrierFor(debt)}</span>
    <span class="dx-status__clock" data-meter="integrity"></span>
    <span class="dx-status__right">
      ${typing ? '<span class="dx-status__dot"></span>' : ''}
      <span class="dx-status__icon" data-meter="trust">${sprite(SIGNAL, airplane ? 0 : Math.ceil(trust / 2.5), 'dx-status__signal')}</span>
      <span class="dx-status__icon" data-meter="lucidity">${sprite(WIFI, airplane ? 0 : Math.ceil(lucidity / 3.4), 'dx-status__wifi')}</span>
      <span class="dx-status__icon${stability <= 2 ? ' is-low' : ''}" data-meter="stability">${sprite(BATTERY, Math.ceil(Math.max(0, Math.min(10, stability)) / 2.5), 'dx-status__battery')}</span>
    </span>
  `;

  // What moved since the last bar: pop the icon, say the word, play it.
  const now = { integrity, trust, lucidity, stability };
  const changes = [];
  if (lastSeen && !quiet) {
    for (const meter of Object.keys(WORDS).filter((m) => !hidden.includes(m))) {
      const d = now[meter] - lastSeen[meter];
      if (d) changes.push({ meter, up: d > 0 });
    }
  }
  lastSeen = now;
  if (changes.length) {
    const words = document.createElement('span');
    words.className = 'dx-status__words';
    for (const { meter, up } of changes) {
      el.querySelector(`[data-meter="${meter}"]`)?.classList.add(up ? 'is-up' : 'is-down');
      const w = document.createElement('span');
      w.className = up ? 'is-up' : 'is-down';
      w.textContent = `${up ? '▲' : '▼'} ${WORDS[meter]}`;
      words.appendChild(w);
    }
    el.appendChild(words);
    playMeterChange(changes);
  }

  for (const meter of hidden) el.querySelector(`[data-meter="${meter}"]`)?.classList.add('is-concealed');

  // The clock keeps real time while you're honest. Below 7 Integrity it
  // starts to slip: some ticks show the wrong minutes; near the bottom it
  // can't hold a time at all.
  const clock = el.querySelector('.dx-status__clock');
  function tick() {
    const now = new Date();
    let text = `${now.getHours() % 12 || 12}:${pad(now.getMinutes())}`;
    const slip = integrity >= 7 ? 0 : (7 - integrity) * 0.12;
    if (Math.random() < slip) {
      text = integrity <= 2 && Math.random() < 0.5
        ? '--:--'
        : `${now.getHours() % 12 || 12}:${pad(Math.floor(Math.random() * 60))}`;
      clock.classList.add('is-glitch');
    } else {
      clock.classList.remove('is-glitch');
    }
    clock.textContent = text;
  }
  tick();
  const timer = setInterval(tick, 1000);

  function setTyping(on) {
    const right = el.querySelector('.dx-status__right');
    let dot = el.querySelector('.dx-status__dot');
    if (on && !dot) {
      dot = document.createElement('span');
      dot.className = 'dx-status__dot';
      right.prepend(dot);
    } else if (!on && dot) {
      dot.remove();
    }
  }

  // The tutorial pointing at one meter: its icon pulses, its word shows
  // under the bar, and its own blip plays (rising, as a hello).
  function flash(meter) {
    if (!WORDS[meter]) return;
    const icon = el.querySelector(`[data-meter="${meter}"]`);
    icon?.classList.remove('is-up', 'is-down');
    void icon?.offsetWidth;
    icon?.classList.add('is-up');
    el.querySelector('.dx-status__words')?.remove();
    const words = document.createElement('span');
    words.className = 'dx-status__words';
    const w = document.createElement('span');
    w.className = 'is-up';
    w.textContent = WORDS[meter];
    words.appendChild(w);
    el.appendChild(words);
    playMeterChange([{ meter, up: true }]);
  }

  // The first time a meter is named: it appears, then flashes like any cue.
  function reveal(meter) {
    const icon = el.querySelector(`[data-meter="${meter}"]`);
    if (icon?.classList.contains('is-concealed')) {
      icon.classList.remove('is-concealed');
      icon.classList.add('is-revealing');
    }
    flash(meter);
  }

  return { el, setTyping, flash, reveal, destroy: () => clearInterval(timer) };
}
