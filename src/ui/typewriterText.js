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
// never mid-character between individual char spans.
import { emotionColor } from '../engine/loadout.js';

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

// `startRevealed` skips the character-by-character draw and shows the full
// text immediately — for re-rendering a line that already finished drawing
// once (e.g. dialogScene rebuilding its screen when the player picks a FEELZ
// emotion, without replaying the node's prompt from scratch).
export function createTypewriter(container, text, { onDone, onChar, startRevealed = false } = {}) {
  container.innerHTML = '';
  const segments = parseSegments(text);

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
      wordSpan = null;
      container.appendChild(document.createTextNode(' '));
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

  function finishNow() {
    if (done) return;
    clearTimeout(timer);
    charSpans.forEach((span) => span.classList.add('is-visible'));
    done = true;
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
    timer = setTimeout(step, seg.delayMs);
  }

  if (startRevealed) {
    charSpans.forEach((span) => span.classList.add('is-visible'));
    done = true;
  } else {
    step();
  }

  return {
    finish: finishNow,
    isDone: () => done,
    destroy: () => clearTimeout(timer),
  };
}
