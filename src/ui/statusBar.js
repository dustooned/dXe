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

function bars(level, max) {
  return Array.from({ length: max }, (_, i) =>
    `<span class="dx-status__bar${i < level ? ' is-on' : ''}" style="height:${((i + 1) / max) * 100}%"></span>`
  ).join('');
}

function carrierFor(debt) {
  if (debt <= 2) return 'FEELZ 5G';
  if (debt <= 5) return 'FEELZ LTE';
  if (debt <= 7) return 'FEELZ E';
  return 'No Service';
}

function wifiSvg(level) {
  // Three arcs + dot; lit from the dot outward.
  const on = (n) => (level >= n ? 'is-on' : '');
  return `<svg class="dx-status__wifi" viewBox="0 0 24 18" aria-hidden="true">
    <path class="${on(3)}" d="M1 6.5a16 16 0 0 1 22 0" />
    <path class="${on(2)}" d="M4.5 10a11 11 0 0 1 15 0" />
    <path class="${on(1)}" d="M8 13.5a6 6 0 0 1 8 0" />
    <circle class="${level > 0 ? 'is-on' : ''}" cx="12" cy="16.5" r="1.4" />
  </svg>`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function createStatusBar(stats, { typing = false, airplane = false } = {}) {
  const integrity = stats.integrity ?? 0;
  const trust = stats.trust ?? 0;
  const lucidity = stats.lucidity ?? 0;
  const stability = stats.stability ?? 0;
  const debt = stats.truthDebt ?? 0;

  const el = document.createElement('div');
  el.className = `dx-status${airplane ? ' is-airplane' : ''}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Integrity ${integrity}, trust ${trust}, lucidity ${lucidity}, stability ${stability} of 10`);

  const batteryPct = Math.max(0, Math.min(100, stability * 10));
  el.innerHTML = `
    <span class="dx-status__carrier">${airplane ? '✈' : carrierFor(debt)}</span>
    <span class="dx-status__clock"></span>
    <span class="dx-status__right">
      ${typing ? '<span class="dx-status__dot"></span>' : ''}
      <span class="dx-status__signal">${bars(airplane ? 0 : Math.ceil(trust / 2.5), 4)}</span>
      ${wifiSvg(airplane ? 0 : Math.ceil(lucidity / 3.4))}
      <span class="dx-status__battery${stability <= 2 ? ' is-low' : ''}">
        <span class="dx-status__charge" style="width:${batteryPct}%"></span>
      </span>
    </span>
  `;

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

  return { el, setTyping, destroy: () => clearInterval(timer) };
}
