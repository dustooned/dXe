// SVG radial dartboard replacing the 3-button FEELZ wheel.
// All 8 emotions are always visible; the player's class (loadout) determines
// which 3 are "active" (colored, selectable, amplifiable). The other 5 are
// dimmed outlines — visible but locked for this run.
//
// Same tap + drag-to-card API as feelzWheel.js:
//   - tap a segment → select, source = 'tap' (no card color change)
//   - drag segment onto card → select, source = 'drag' (card colors)
//
// API: createFeelzDartboard({ loadout, dropTarget, onSelect, selected })
//   loadout   — class key ('Guns' | 'Bible' | 'Crystals')
//   dropTarget — { el, setPreviewColor } — the swipe card
//   onSelect  — (emotion, source) callback
//   selected  — currently active emotion (re-applied on re-render)
import { EMOTIONS, EMOTION_ORDER, CLASSES } from '../engine/loadout.js';

const NS = 'http://www.w3.org/2000/svg';
const CX = 100, CY = 100, OUTER_R = 88, INNER_R = 34, SYMBOL_R = 61;
// Center Joy at the top; sectors go clockwise.
const START = -Math.PI / 2 - Math.PI / 8;
const STEP = (2 * Math.PI) / 8;
const HALF_GAP = 0.03;
const DRAG_THRESHOLD = 6;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function sectorPath(i) {
  const a0 = START + i * STEP + HALF_GAP;
  const a1 = START + (i + 1) * STEP - HALF_GAP;
  const fmt = (n) => n.toFixed(3);
  const ix0 = fmt(CX + INNER_R * Math.cos(a0)), iy0 = fmt(CY + INNER_R * Math.sin(a0));
  const ox0 = fmt(CX + OUTER_R * Math.cos(a0)), oy0 = fmt(CY + OUTER_R * Math.sin(a0));
  const ox1 = fmt(CX + OUTER_R * Math.cos(a1)), oy1 = fmt(CY + OUTER_R * Math.sin(a1));
  const ix1 = fmt(CX + INNER_R * Math.cos(a1)), iy1 = fmt(CY + INNER_R * Math.sin(a1));
  return `M ${ix0} ${iy0} L ${ox0} ${oy0} A ${OUTER_R} ${OUTER_R} 0 0 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${INNER_R} ${INNER_R} 0 0 0 ${ix0} ${iy0} Z`;
}

function symbolPos(i) {
  const mid = START + (i + 0.5) * STEP;
  return { x: CX + SYMBOL_R * Math.cos(mid), y: CY + SYMBOL_R * Math.sin(mid) };
}

function isOverEl(el, x, y) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

export function createFeelzDartboard({ loadout, dropTarget, onSelect, selected }) {
  const activeEmotions = new Set(CLASSES[loadout]?.emotions ?? []);

  const wrapper = document.createElement('div');
  wrapper.className = 'dx-dartboard';

  const svg = svgEl('svg', { viewBox: '0 0 200 200', role: 'group', 'aria-label': 'FEELZ' });
  wrapper.appendChild(svg);

  // Track which path/text belongs to each emotion so we can update visual state.
  const segments = {};

  function applyState(emotion, path, label) {
    const em = EMOTIONS[emotion];
    const isActive = activeEmotions.has(emotion);
    const isSel = emotion === selected;

    if (!isActive) {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#ffffff');
      path.setAttribute('stroke-width', '1');
      path.setAttribute('opacity', '0.15');
      label.setAttribute('opacity', '0.15');
    } else if (isSel) {
      path.setAttribute('fill', '#000000');
      path.setAttribute('stroke', em.color);
      path.setAttribute('stroke-width', '3');
      path.setAttribute('opacity', '1');
      label.setAttribute('fill', em.color);
      label.setAttribute('opacity', '1');
    } else {
      path.setAttribute('fill', em.color);
      path.setAttribute('stroke', '#000000');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('opacity', '1');
      label.setAttribute('fill', '#000000');
      label.setAttribute('opacity', '1');
    }
  }

  EMOTION_ORDER.forEach((emotion, i) => {
    const em = EMOTIONS[emotion];
    const isActive = activeEmotions.has(emotion);
    const pos = symbolPos(i);

    const path = svgEl('path', { d: sectorPath(i) });
    const label = svgEl('text', {
      x: pos.x.toFixed(2),
      y: pos.y.toFixed(2),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': '14',
      'font-family': 'monospace',
      'pointer-events': 'none',
    });
    label.textContent = em.symbol;

    const g = svgEl('g');
    if (isActive) {
      g.style.cursor = 'grab';
      g.style.touchAction = 'none';
      g.style.userSelect = 'none';
    } else {
      g.style.pointerEvents = 'none';
    }
    g.appendChild(path);
    g.appendChild(label);
    svg.appendChild(g);

    applyState(emotion, path, label);
    segments[emotion] = { path, label, g };

    if (!isActive) return;

    let dragging = false, startX, startY, ghost;

    g.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      g.setPointerCapture(e.pointerId);
    });

    g.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!ghost && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        ghost = document.createElement('div');
        ghost.className = 'dx-feelz__ghost';
        ghost.style.setProperty('--bubble-color', em.color);
        ghost.textContent = em.symbol;
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      }
      if (dropTarget) {
        const over = isOverEl(dropTarget.el, e.clientX, e.clientY);
        dropTarget.setPreviewColor(over ? em.color : null);
      }
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (ghost) { ghost.remove(); ghost = null; }
      dropTarget?.setPreviewColor(null);

      const onCard = dropTarget && isOverEl(dropTarget.el, e.clientX, e.clientY);
      const wasTap = Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD;

      if (onCard) {
        selectEmotion(emotion, 'drag');
      } else if (wasTap) {
        selectEmotion(emotion, 'tap');
      }
      // drag that didn't land on card — no selection change
    }

    g.addEventListener('pointerup', endDrag);
    g.addEventListener('pointercancel', endDrag);
  });

  function selectEmotion(emotion, source) {
    // Update visuals for all active segments
    Object.entries(segments).forEach(([em, { path, label }]) => {
      applyState(em, path, label);
    });
    // Highlight selected
    const { path, label } = segments[emotion];
    const em = EMOTIONS[emotion];
    path.setAttribute('fill', '#000000');
    path.setAttribute('stroke', em.color);
    path.setAttribute('stroke-width', '3');
    label.setAttribute('fill', em.color);

    onSelect?.(emotion, source);
  }

  function reset() {
    Object.entries(segments).forEach(([em, { path, label }]) => {
      applyState(em, path, label);
    });
  }

  return { el: wrapper, reset };
}
