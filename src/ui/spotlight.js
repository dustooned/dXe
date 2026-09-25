// Tutorial spotlight: a black vignette over the whole screen with soft-edged
// holes cut around the elements being talked about right now (the wheel as
// the Therapist asks you to point, the meters as she mentions "four little
// lines"). Everything else sinks into the dark until the moment passes.
//
// Purely visual — pointer-events: none — so nothing under the mask is ever
// blocked. The spotlight directs attention; it never gates input, so there's
// no way for a mis-measured hole to soft-lock the player.
//
// `container` must be a positioned element (dialogScene's .dx-game-screen).
// The mask is sized to the container's full scroll height and positioned in
// its content coordinates, so it scrolls with the content rather than
// drifting off it. Returns { destroy }.
const NS = 'http://www.w3.org/2000/svg';
const PAD = 10;
const MASK_OPACITY = 0.82;
let idCounter = 0;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function createSpotlight(container, targets) {
  const els = targets.filter(Boolean);
  if (!els.length) return { destroy() {} };

  const id = ++idCounter;
  const svg = svgEl('svg', { class: 'dx-spotlight', 'aria-hidden': 'true' });
  const defs = svgEl('defs');
  // The blur is what makes each hole a vignette instead of a hard cutout.
  const filter = svgEl('filter', { id: `dx-spot-blur-${id}`, x: '-50%', y: '-50%', width: '200%', height: '200%' });
  filter.appendChild(svgEl('feGaussianBlur', { stdDeviation: '9' }));
  const mask = svgEl('mask', { id: `dx-spot-mask-${id}`, maskUnits: 'userSpaceOnUse' });
  const maskBg = svgEl('rect', { x: 0, y: 0, fill: 'white' });
  const holes = svgEl('g', { filter: `url(#dx-spot-blur-${id})` });
  mask.append(maskBg, holes);
  defs.append(filter, mask);
  const shade = svgEl('rect', {
    x: 0, y: 0, fill: '#000', 'fill-opacity': MASK_OPACITY, mask: `url(#dx-spot-mask-${id})`,
  });
  svg.append(defs, shade);
  container.appendChild(svg);

  function layout() {
    const box = container.getBoundingClientRect();
    const w = container.clientWidth;
    const h = Math.max(container.scrollHeight, container.clientHeight);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const r of [maskBg, shade]) {
      r.setAttribute('width', w);
      r.setAttribute('height', h);
    }
    holes.replaceChildren();
    for (const el of els) {
      if (!el.isConnected || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      holes.appendChild(svgEl('rect', {
        x: r.left - box.left - PAD,
        y: r.top - box.top + container.scrollTop - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
        rx: 14,
        fill: 'black',
      }));
    }
  }

  // Measure after layout settles; typewriters and fade-ins can still be
  // growing the targets, so re-measure a few times over the first second.
  const timers = [0, 120, 400, 900].map((ms) => setTimeout(() => requestAnimationFrame(layout), ms));
  window.addEventListener('resize', layout);

  return {
    layout,
    destroy() {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', layout);
      svg.remove();
    },
  };
}
