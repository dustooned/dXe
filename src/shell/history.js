// History page (About → OVERVIEW & HISTORY): the making of the game, told in
// phases with short hand-picked excerpts. Content lives in historyData.js.
import { INTRO, PHASES } from './historyData.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

function phaseEl(p) {
  const li = el('li', 'dx-history__event');
  li.append(
    el('p', 'dx-text dx-credits__sub', p.when),
    el('p', 'dx-text dx-credits__name', p.title),
    el('p', 'dx-text', p.text),
  );
  if (p.excerpt) {
    const q = el('blockquote', 'dx-history__quote');
    q.append(el('p', 'dx-text', `"${p.excerpt.quote}"`), el('p', 'dx-text dx-credits__sub', `— ${p.excerpt.source}`));
    li.appendChild(q);
  }
  if (p.then || p.now) {
    const tn = el('div', 'dx-history__thennow');
    if (p.then) tn.appendChild(el('p', 'dx-text', `THEN: ${p.then}`));
    if (p.now) tn.appendChild(el('p', 'dx-text', `NOW: ${p.now}`));
    li.appendChild(tn);
  }
  if (p.image) {
    const img = el('img', 'dx-history__img');
    img.src = p.image.src;
    img.alt = p.image.alt ?? '';
    li.appendChild(img);
  }
  return li;
}

export function renderHistory(stage, { back }) {
  const screen = el('div', 'dx-screen dx-history');
  screen.append(el('h2', 'dx-title', 'THE MAKING OF'), el('p', 'dx-text', INTRO));
  const list = el('ol', 'dx-history__timeline');
  for (const p of PHASES) list.appendChild(phaseEl(p));
  const backBtn = el('button', 'dx-btn', 'BACK');
  backBtn.addEventListener('click', back);
  screen.append(list, backBtn);
  stage.appendChild(screen);
}
