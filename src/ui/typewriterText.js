// Character-by-character text reveal (Earthbound/Undertale/Deltarune
// style), with inline speed markup for dramatic pacing:
//   {slow}...{/slow}   reveals that stretch slower than normal
//   {fast}...{/fast}   reveals that stretch faster than normal
//   {pause:250}        a dramatic beat — no character revealed, just a gap
//
// Full text is pre-laid-out as invisible spans up front so line-wrapping
// never shifts as characters reveal, and "finish instantly" is just
// making everything visible at once rather than re-rendering anything.
const DEFAULT_MS_PER_CHAR = 28;
const SPEED_MULTIPLIER = { slow: 2.6, fast: 0.35, normal: 1 };
const TAG_PATTERN = /\{(\/?)(slow|fast)\}|\{pause:(\d+)\}/g;

export function parseSegments(raw) {
  const segments = [];
  const speedStack = ['normal'];
  let lastIndex = 0;
  let match;

  function pushChars(text) {
    const speed = speedStack[speedStack.length - 1];
    for (const char of text) {
      if (char === '\n') {
        segments.push({ type: 'br' });
      } else {
        segments.push({ type: 'char', char, delayMs: DEFAULT_MS_PER_CHAR * SPEED_MULTIPLIER[speed] });
      }
    }
  }

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(raw))) {
    pushChars(raw.slice(lastIndex, match.index));
    lastIndex = TAG_PATTERN.lastIndex;

    if (match[3] != null) {
      segments.push({ type: 'pause', delayMs: Number(match[3]) });
    } else if (match[1] === '/') {
      if (speedStack.length > 1) speedStack.pop();
    } else {
      speedStack.push(match[2]);
    }
  }
  pushChars(raw.slice(lastIndex));

  return segments;
}

export function createTypewriter(container, text, { onDone, onChar } = {}) {
  container.innerHTML = '';
  const segments = parseSegments(text);

  const charSpans = [];
  for (const seg of segments) {
    if (seg.type === 'br') {
      container.appendChild(document.createElement('br'));
      continue;
    }
    if (seg.type !== 'char') continue;
    const span = document.createElement('span');
    span.className = 'dx-typewriter-char';
    span.textContent = seg.char === ' ' ? ' ' : seg.char;
    container.appendChild(span);
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

  step();

  return {
    finish: finishNow,
    isDone: () => done,
    destroy: () => clearTimeout(timer),
  };
}
