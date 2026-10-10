// The illustrated plate on each NPC's chapter page (scenes/markerScene.js):
// their environment, drawn 1-bit, white ink on black, with dither patterns
// for the grays. PLACEHOLDER ART — simple geometry until the real plates
// are drawn (ART_GUIDE.md); each is a 240x150 SVG string.

const INK = '#ecebe4';
const PAPER = '#000';

// Dithers, lightest to densest: sparse dots, checker, dense.
const DEFS = `<defs>
  <pattern id="pd1" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="${INK}"/></pattern>
  <pattern id="pd2" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="${INK}"/></pattern>
  <pattern id="pd3" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${INK}"/><rect width="1" height="1" fill="${PAPER}"/></pattern>
  <pattern id="pd4" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="${INK}"/><rect x="1" y="1" width="1" height="1" fill="${INK}"/></pattern>
</defs>`;

const svg = (body) => `<svg viewBox="0 0 240 150" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${DEFS}<rect width="240" height="150" fill="${PAPER}"/>${body}</svg>`;
const line = (x1, y1, x2, y2, w = 1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${w}"/>`;

const PLATES = {
  // The third floor: a hallway to her door, the bulb hanging over it, the mat.
  deborah: svg(`
    <polygon points="0,0 70,30 70,120 0,150" fill="url(#pd1)"/>
    <polygon points="240,0 170,30 170,120 240,150" fill="url(#pd1)"/>
    <polygon points="0,150 70,120 170,120 240,150" fill="url(#pd4)"/>
    ${line(0, 0, 70, 30)}${line(240, 0, 170, 30)}${line(0, 150, 70, 120)}${line(240, 150, 170, 120)}
    <rect x="70.5" y="30.5" width="99" height="89" fill="none" stroke="${INK}"/>
    <rect x="102" y="46" width="36" height="74" fill="url(#pd2)"/>
    <rect x="104" y="48" width="32" height="70" fill="${PAPER}"/>
    <rect x="130" y="84" width="3" height="3" fill="${INK}"/>
    ${line(120, 0, 120, 16)}
    <circle cx="120" cy="20" r="4" fill="${INK}"/>
    <circle cx="120" cy="20" r="12" fill="url(#pd1)"/>
    <rect x="98" y="118" width="44" height="5" fill="url(#pd3)"/>
    <rect x="18" y="56" width="24" height="18" fill="none" stroke="${INK}" transform="rotate(-6 30 65)"/>`),

  // Behind the strip: brick, a half-dead sign, the payphone, the painted-over mural.
  rwanda: svg(`
    <rect width="240" height="150" fill="url(#pd1)"/>
    ${[18, 36, 54, 72, 90, 108, 126].map((y) => line(0, y, 240, y)).join('')}
    <rect x="40" y="14" width="110" height="26" fill="${PAPER}" stroke="${INK}"/>
    <text x="52" y="33" fill="${INK}" font-family="monospace" font-size="16" letter-spacing="4">O<tspan fill="url(#pd2)">PE</tspan>N</text>
    <rect x="22" y="66" width="76" height="70" fill="url(#pd3)"/>
    <rect x="34" y="78" width="52" height="46" fill="${PAPER}"/>
    <circle cx="60" cy="98" r="12" fill="none" stroke="${INK}"/>
    <rect x="174" y="58" width="34" height="62" fill="${PAPER}" stroke="${INK}"/>
    <rect x="180" y="66" width="22" height="14" fill="url(#pd2)"/>
    ${line(186, 92, 186, 112)}${line(186, 112, 196, 120)}
    <rect x="0" y="136" width="240" height="14" fill="url(#pd4)"/>`),

  // The garage: the bay door half up, the radio, the stuck calendar, the drum.
  samun: svg(`
    <rect x="30" y="10" width="180" height="70" fill="url(#pd2)"/>
    ${[22, 34, 46, 58, 70].map((y) => line(30, y, 210, y)).join('')}
    <rect x="30.5" y="10.5" width="179" height="129" fill="none" stroke="${INK}"/>
    <rect x="31" y="80" width="178" height="59" fill="${PAPER}"/>
    <rect x="0" y="139" width="240" height="11" fill="url(#pd4)"/>
    <rect x="166" y="96" width="30" height="16" fill="${PAPER}" stroke="${INK}"/>
    <circle cx="174" cy="104" r="4" fill="url(#pd2)"/>
    ${line(186, 100, 192, 100)}${line(186, 104, 192, 104)}${line(186, 108, 192, 108)}
    <rect x="218" y="30" width="18" height="24" fill="${PAPER}" stroke="${INK}"/>
    <rect x="220" y="38" width="14" height="14" fill="url(#pd1)"/>
    <ellipse cx="62" cy="104" rx="16" ry="5" fill="none" stroke="${INK}"/>
    <rect x="46" y="104" width="32" height="32" fill="url(#pd3)"/>
    <ellipse cx="62" cy="136" rx="16" ry="5" fill="${PAPER}" stroke="${INK}"/>`),

  // The lot outside the bar: the door, the bikes lined up, the flyer, the ashtray.
  rick: svg(`
    <rect width="240" height="96" fill="url(#pd1)"/>
    ${line(0, 96, 240, 96)}
    <rect x="98" y="30" width="44" height="66" fill="${PAPER}" stroke="${INK}"/>
    <rect x="102" y="34" width="36" height="20" fill="url(#pd2)"/>
    <rect x="150" y="40" width="16" height="22" fill="${PAPER}" stroke="${INK}" transform="rotate(4 158 51)"/>
    <rect x="176" y="80" width="12" height="4" fill="url(#pd3)"/>
    <rect x="0" y="96" width="240" height="54" fill="url(#pd4)"/>
    ${[[30, 124], [72, 128], [196, 126]].map(([x, y]) => `
      <circle cx="${x}" cy="${y}" r="9" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>
      <circle cx="${x + 26}" cy="${y}" r="9" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>
      ${line(x, y, x + 12, y - 12, 2)}${line(x + 12, y - 12, x + 26, y, 2)}${line(x + 8, y - 16, x + 18, y - 12, 2)}`).join('')}`),
};

export function plateSvg(key) {
  return PLATES[key] ?? svg('');
}
