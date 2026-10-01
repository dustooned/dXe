// The word FEELZ is always the app's logo: each letter in a feeling's
// color, wherever it appears on screen (the same five the launch logo uses).
// Two paths cover everything:
//   - typed text: ui/typewriterText.js colors the letters as it parses
//   - everything else: a MutationObserver here wraps any static text node
//     containing FEELZ in per-letter colored spans as it's added
export const FEELZ_COLORS = ['Anger', 'Happy', 'Trust', 'Sadness', 'Anxiety'];
const WORD = 'FEELZ';

function colorize(textNode) {
  const text = textNode.nodeValue;
  if (!text.includes(WORD)) return;
  const frag = document.createDocumentFragment();
  let at = 0;
  let i;
  while ((i = text.indexOf(WORD, at)) !== -1) {
    if (i > at) frag.appendChild(document.createTextNode(text.slice(at, i)));
    const word = document.createElement('span');
    word.className = 'dx-feelz-word';
    [...WORD].forEach((ch, k) => {
      const letter = document.createElement('span');
      letter.textContent = ch;
      letter.style.color = `var(--color-feelz-${FEELZ_COLORS[k].toLowerCase()})`;
      word.appendChild(letter);
    });
    frag.appendChild(word);
    at = i + WORD.length;
  }
  if (at < text.length) frag.appendChild(document.createTextNode(text.slice(at)));
  textNode.replaceWith(frag);
}

function sweep(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.parentElement?.closest('.dx-feelz-word, script, style, svg')) colorize(node);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || node.closest('.dx-feelz-word, svg')) return;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.includes(WORD)) hits.push(walker.currentNode);
  hits.forEach((t) => sweep(t));
}

export function initFeelzWord(root = document.body) {
  sweep(root);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') sweep(r.target);
      else r.addedNodes.forEach(sweep);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
