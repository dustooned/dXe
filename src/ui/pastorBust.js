// Pastor Gabriel's bust: the artist's portrait (Drive NPCs/Samael,
// Pastor_Gabriel.gif, 192x192, 1-bit, 5 frames), the lake behind him.
// ROWS/COLORS below are the old code-drawn placeholder (halo, collar, folded
// wings), kept because the artist kit and asset bible scripts still draw it.
export const ROWS = [
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
export const COLORS = { H: '#ffd54a', F: '#d9cfc4', K: '#111111', W: '#3a3a46', C: '#e8e8e8' };

const ART = '/assets/lake-ulysses/characters/gabriel/pastor_gabriel.gif';

export function createPastorBust() {
  const el = document.createElement('div');
  el.className = 'dx-pastor-bust';
  const img = document.createElement('img');
  img.src = ART;
  img.alt = '';
  el.appendChild(img);
  return el;
}
