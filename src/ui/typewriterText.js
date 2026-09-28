// Character-by-character text reveal (Earthbound/Undertale/Deltarune
// style), with inline speed markup for dramatic pacing:
//   {slow}...{/slow}       reveals that stretch slower than normal
//   {fast}...{/fast}       reveals that stretch faster than normal
//   {pause:250}            a dramatic beat — no character revealed, just a gap
//   {color:Anger}...{/color}  tints the enclosed text with that FEELZ
//                             emotion's color (engine/loadout.js's
//                             emotionColor()) — the same word-tinting trick
//                             questionnaireScene.js's Therapist diagnosis
//                             uses, just running through the character
//                             reveal instead of appearing fully drawn. See
//                             docs/IT_DESIGN.md's "IT is the hint system".
//
// Full text is pre-laid-out as invisible spans up front so line-wrapping
// never shifts as characters reveal, and "finish instantly" is just
// making everything visible at once rather than re-rendering anything.
//
// Each word's character spans are wrapped in a dx-typewriter-word
// (display:inline-block) so the browser wraps at word boundaries only,
// never mid-character between individual char spans. The space after a
// word goes inside that word's span as a non-breaking space: a bare space
// between two inline-blocks can wrap onto the start of the next line when
// the word before it ends flush with the edge, indenting that line.
//
// Long text is split into pages at sentence ends (see paginate()), each
// drawn fresh in the same box, so nothing ever becomes a wall of text.
// Callers don't change: finish() on a finished page turns to the next one,
// and isDone()/onDone only report true after the last page.
import { emotionColor } from '../engine/loadout.js';
import { loadSettings } from '../shell/settings.js';

// The player's text speed setting scales every character delay (the
// authored {slow}/{fast}/{pause} rhythm stays proportional); 'instant'
// shows each page whole.
const TEXT_SPEED = { normal: 1, fast: 0.45, instant: 0 };

const DEFAULT_MS_PER_CHAR = 28;
const SPEED_MULTIPLIER = { slow: 2.6, fast: 0.35, normal: 1 };
const TAG_PATTERN = /\{(\/?)(slow|fast)\}|\{color:(\w+)\}|\{(\/)color\}|\{pause:(\d+)\}/g;

export function parseSegments(raw) {
  const segments = [];
  const speedStack = ['normal'];
  const colorStack = [null];
  let lastIndex = 0;
  let match;

  function pushChars(text) {
    const speed = speedStack[speedStack.length - 1];
    const color = colorStack[colorStack.length - 1];
    for (const char of text) {
      if (char === '\n') {
        segments.push({ type: 'br' });
      } else {
        segments.push({ type: 'char', char, delayMs: DEFAULT_MS_PER_CHAR * SPEED_MULTIPLIER[speed], color });
      }
    }
  }

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(raw))) {
    pushChars(raw.slice(lastIndex, match.index));
    lastIndex = TAG_PATTERN.lastIndex;

    if (match[5] != null) {
      segments.push({ type: 'pause', delayMs: Number(match[5]) });
    } else if (match[3] != null) {
      colorStack.push(match[3]);
    } else if (match[4] === '/') {
      if (colorStack.length > 1) colorStack.pop();
    } else if (match[1] === '/') {
      if (speedStack.length > 1) speedStack.pop();
    } else {
      speedStack.push(match[2]);
    }
  }
  pushChars(raw.slice(lastIndex));

  return segments;
}

// Pages hold whole sentences, up to about this many characters. A single
// sentence longer than this still gets its own page rather than being cut.
const PAGE_CHARS = 140;
const SENTENCE_END = /[.!?…]/;
const CLOSERS = /["')\]”’]/;

// Splits parsed segments into pages at sentence boundaries: after . ! ? …
// (plus any closing quote/paren) followed by a space or line break. Working
// on segments rather than raw text keeps {slow}/{color} spans intact across
// a page break, since each char segment already carries its own speed/color.
export function paginate(segments) {
  const breaks = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type !== 'char' || !SENTENCE_END.test(seg.char)) continue;
    let j = i + 1;
    while (segments[j]?.type === 'char' && (CLOSERS.test(segments[j].char) || SENTENCE_END.test(segments[j].char))) j++;
    const next = segments[j];
    if (next && (next.type === 'br' || next.char === ' ')) breaks.push(j);
  }

  // Greedy: keep extending the page to the furthest sentence end that
  // still fits; when the next one doesn't, cut at the last one that did.
  const charCount = (from, to) => segments.slice(from, to).filter((s) => s.type === 'char').length;
  const pages = [];
  let start = 0;
  let lastFit = null;
  for (const b of [...breaks, segments.length]) {
    if (charCount(start, b) <= PAGE_CHARS) { lastFit = b; continue; }
    if (lastFit !== null) {
      pages.push(segments.slice(start, lastFit));
      start = lastFit;
    }
    if (charCount(start, b) <= PAGE_CHARS) {
      lastFit = b;
    } else {
      // One sentence longer than a page: it gets a page to itself.
      pages.push(segments.slice(start, b));
      start = b;
      lastFit = null;
    }
  }
  if (start < segments.length) pages.push(segments.slice(start));

  // Drop the whitespace a break leaves at the start of the next page.
  return pages
    .map((page) => {
      let k = 0;
      while (page[k] && (page[k].type === 'br' || page[k].char === ' ')) k++;
      return page.slice(k);
    })
    .filter((page) => page.length);
}

// `startRevealed` skips the character-by-character draw and shows the full
// text immediately — for re-rendering a line that already finished drawing
// once (e.g. dialogScene rebuilding its screen when the player picks a FEELZ
// emotion, without replaying the node's prompt from scratch).
export function createTypewriter(container, text, { onDone, onChar, startRevealed: revealedArg = false } = {}) {
  const speed = TEXT_SPEED[loadSettings().textSpeed] ?? 1;
  const startRevealed = revealedArg || speed === 0;
  const pages = paginate(parseSegments(text));
  let pageIndex = revealedArg ? pages.length - 1 : 0;
  let page = null;

  function isLastPage() {
    return pageIndex >= pages.length - 1;
  }

  function showPage() {
    page?.destroy();
    page = drawPage(container, pages[pageIndex] ?? [], {
      onChar,
      startRevealed,
      speed,
      moreAfter: !isLastPage(),
      onDone: () => { if (isLastPage()) onDone?.(); },
    });
  }

  showPage();

  return {
    // Drawing → reveal this page. Revealed, more to come → next page.
    finish() {
      if (!page.isDone()) { page.finish(); return; }
      if (isLastPage()) return;
      pageIndex += 1;
      showPage();
    },
    isDone: () => isLastPage() && page.isDone(),
    // True while characters are still revealing (a tap now cuts the line
    // short), false when a page is fully shown (a tap only turns the page).
    isDrawing: () => !page.isDone(),
    destroy: () => page.destroy(),
  };
}

// Draws one page into the container, replacing whatever was there.
function drawPage(container, segments, { onDone, onChar, startRevealed, moreAfter, speed = 1 }) {
  container.innerHTML = '';
  container.classList.remove('is-new-page');
  void container.offsetWidth; // restart the new-page pop animation
  container.classList.add('is-new-page');

  // Group character spans by word so the browser can only break at spaces,
  // never mid-word between individual character spans.
  const charSpans = [];
  let wordSpan = null;

  for (const seg of segments) {
    if (seg.type === 'br') {
      wordSpan = null;
      container.appendChild(document.createElement('br'));
      continue;
    }
    if (seg.type !== 'char') continue;

    if (seg.char === ' ') {
      if (wordSpan) wordSpan.appendChild(document.createTextNode('\u00a0'));
      else container.appendChild(document.createTextNode(' '));
      wordSpan = null;
      continue;
    }

    if (!wordSpan) {
      wordSpan = document.createElement('span');
      wordSpan.className = 'dx-typewriter-word';
      container.appendChild(wordSpan);
    }

    const span = document.createElement('span');
    span.className = 'dx-typewriter-char';
    span.textContent = seg.char;
    if (seg.color) span.style.color = emotionColor(seg.color);
    wordSpan.appendChild(span);
    charSpans.push(span);
  }

  let segIndex = 0;
  let charIndex = 0;
  let timer = null;
  let done = false;

  // A ▶ after a finished page that isn't the last says "tap for more."
  const more = document.createElement('span');
  more.className = 'dx-typewriter-more';
  more.textContent = ' ▶';
  more.hidden = true;
  if (moreAfter) container.appendChild(more);

  function finishNow() {
    if (done) return;
    clearTimeout(timer);
    charSpans.forEach((span) => span.classList.add('is-visible'));
    done = true;
    more.hidden = false;
    onDone?.();
  }

  function step() {
    if (segIndex >= segments.length) {
      finishNow();
      return;
    }
    const seg = segments[segIndex];
    segIndex += 1;

    if (seg.type === 'char') {
      charSpans[charIndex]?.classList.add('is-visible');
      onChar?.();
      charIndex += 1;
    }
    timer = setTimeout(step, seg.delayMs * speed);
  }

  if (startRevealed) {
    charSpans.forEach((span) => span.classList.add('is-visible'));
    done = true;
    more.hidden = false;
  } else {
    step();
  }

  return {
    finish: finishNow,
    isDone: () => done,
    destroy: () => clearTimeout(timer),
  };
}
