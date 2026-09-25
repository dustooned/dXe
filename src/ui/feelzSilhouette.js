// The FEELZ boot precursor: a glowing silhouette of the FEELZ wheel, filled
// with a moving rainbow wave in the eight FEELZ colors. Shown on the app's
// logo beat (feelz_launch.json), before the player has used the wheel for
// real — a preview of what they're about to be handed.
//
// How it works: the rainbow is an animated gradient on a plain div, and the
// wheel shape is a CSS mask over it (an inline SVG data URI), so only
// the silhouette shows the color moving underneath. The glow is a
// drop-shadow on a *parent* wrapper — filters on the masked element itself
// would be masked away with everything else. Styles in scenes.css.
const SIZE = 120;
const WHEEL = { cx: 60, cy: 60, outer: 56, inner: 20 };

function wheelSegments() {
  const step = (2 * Math.PI) / 8;
  const start = -Math.PI / 2 - Math.PI / 8;
  const gap = 0.05;
  const { cx, cy, outer, inner } = WHEEL;
  const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a0 = start + i * step + gap;
    const a1 = start + (i + 1) * step - gap;
    d += `M ${pt(inner, a0)} L ${pt(outer, a0)} A ${outer} ${outer} 0 0 1 ${pt(outer, a1)} L ${pt(inner, a1)} A ${inner} ${inner} 0 0 0 ${pt(inner, a0)} Z `;
  }
  return `<path d="${d}"/>`;
}

function silhouetteSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" fill="white">${wheelSegments()}</svg>`;
}

export function createFeelzSilhouette() {
  const el = document.createElement('div');
  el.className = 'dx-feelz-sil';
  el.setAttribute('aria-hidden', 'true');

  const fill = document.createElement('div');
  fill.className = 'dx-feelz-sil__fill';
  const url = `url("data:image/svg+xml,${encodeURIComponent(silhouetteSvg())}")`;
  fill.style.maskImage = url;
  fill.style.webkitMaskImage = url;

  el.appendChild(fill);
  return { el, destroy() { el.remove(); } };
}
