// Pastor Gabriel's bust — a PLACEHOLDER pixel sprite until real art lands:
// halo, a pale face, a clerical collar, and dark wings folded behind the
// shoulders. The angel of death in shirtsleeves. Hard-edged SVG cells.
const ROWS = [
  '......HHHHHHHH......',
  '.....H........H.....',
  '......HHHHHHHH......',
  '........FFFF........',
  '.......FFFFFF.......',
  '.......FKFFKF.......',
  '.......FFFFFF.......',
  '........FFFF........',
  '.........FF.........',
  'WW...CCCCKKCCCC...WW',
  'WWW.CCCCCKKCCCCC.WWW',
  'WWWWCCCCCCCCCCCCWWWW',
  '.WWWCCCCCCCCCCCCWWW.',
  '..WWCCCCCCCCCCCCWW..',
  '...WCCCCCCCCCCCCW...',
  '....CCCCCCCCCCCC....',
];
const COLORS = { H: '#ffd54a', F: '#d9cfc4', K: '#111111', W: '#3a3a46', C: '#e8e8e8' };

export function createPastorBust() {
  const w = ROWS[0].length;
  let cells = '';
  ROWS.forEach((row, y) => {
    if (row.length !== w) throw new Error(`pastorBust row ${y} is ${row.length} wide, not ${w}`);
    [...row].forEach((ch, x) => {
      if (COLORS[ch]) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLORS[ch]}" class="dx-bust-${ch}"/>`;
    });
  });
  const el = document.createElement('div');
  el.className = 'dx-pastor-bust';
  el.innerHTML = `<svg viewBox="0 0 ${w} ${ROWS.length}" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
  return el;
}
