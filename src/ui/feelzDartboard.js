// SVG radial dartboard replacing the 3-button FEELZ wheel.
// All 8 emotions are always visible; the player's class (loadout) determines
// which 3 are "active" (colored, selectable, amplifiable). The other 5 are
// dimmed outlines — visible but locked for this run.
//
// Same tap + drag-to-card API as feelzWheel.js:
//   - tap a segment → select, source = 'tap'
//   - drag segment onto card → select, source = 'drag'
//   - touch-and-hold a segment → listen only, no select (see HOLD_MS)
// `source` used to also decide whether the card's border colored (drag
// only, "keeps drag meaningful") — a tap that visibly did nothing read as
// broken rather than restrained, so dialogScene.js now colors the card on
// both. `source` is still passed through for whatever distinction, if any,
// turns out to be worth keeping.
//
// API: createFeelzDartboard({ loadout, dropTarget, onSelect, selected, harmonicFunction })
//   loadout   — class key ('Guns' | 'Bible' | 'Crystals')
//   dropTarget — { el, setPreviewColor } — the swipe card
//   onSelect  — (emotion, source) callback
//   selected  — currently active emotion (re-applied on re-render)
//   harmonicFunction — the encounter's current cadence stage ('predominant'
//                      /'dominant'/'tonic'), passed straight through to the
//                      hover/select tones below so a wedge previews exactly
//                      the pitch it would strike right now, not a guess.
//
// Wheel-interaction audio lives here, not in the caller: hovering a wedge
// sounds a very faint preview of its current chord pitch, gone the instant
// the pointer leaves; picking one rings that same pitch out loud and settles
// into a quiet low drone marking "this is the current pick" until the choice
// commits (see shell/audio.js's "FEELZ wheel hover/select tones").
import { EMOTIONS, EMOTION_ORDER, CLASSES } from '../engine/loadout.js';
import * as audio from '../shell/audio.js';
import { iconCells, iconHtml, showBody, feel } from './feelingIcons.js';

const NS = 'http://www.w3.org/2000/svg';
const CX = 100, CY = 100, OUTER_R = 88, INNER_R = 34, SYMBOL_R = 61;
// Center Happy at the top; sectors go clockwise.
const START = -Math.PI / 2 - Math.PI / 8;
const STEP = (2 * Math.PI) / 8;
const HALF_GAP = 0.03;
// Distinguishes a tap from the start of a drag-to-card gesture. Was 6px —
// fine for a mouse, far too tight for a finger: real touch input commonly
// jitters 6-15px between touchstart and touchend even on a dead-still tap
// (contact-area shift, digitizer noise), so a meaningful fraction of taps
// were silently misread as an aborted drag and dropped with zero feedback
// (the "sometimes responds" bug report). Fuzz-tested with simulated touch
// jitter in that 3-15px range: 6px had a ~65% false-negative rate on taps
// above it; 20px had zero false negatives while still leaving an intentional
// drag toward the card (which travels 60px+) unambiguous.
const DRAG_THRESHOLD = 20;
// Touch/pen only: a finger held still on a wedge this long becomes a
// listen, not a pick — the tone swells, the wedge pulses, and letting go
// picks nothing. It's the phone's stand-in for mouse hover (which already
// previews the tone). Mouse is left alone: a slow click is still a click.
// Well above any real tap's duration so a deliberate tap never lands here.
const HOLD_MS = 550;

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

// `fresh` (optional): a feeling just unlocked this run — its slice lights up
// with a glow the first time the wheel shows it (engine/unlocks.js).
export function createFeelzDartboard({ loadout, unlocked = [], fresh = null, dropTarget, onSelect, selected, harmonicFunction = 'tonic' }) {
  const activeEmotions = new Set([...(CLASSES[loadout]?.emotions ?? []), ...unlocked]);
  // Same order engine/loadout.js's emotionsForClass() returns (Set preserves
  // insertion order) — has to match dialogScene.js's own ordering exactly,
  // since it's this order that decides which chord voice index each emotion
  // maps to (shell/harmony.js's chordFor).
  const activeEmotionsOrder = [...activeEmotions];

  const wrapper = document.createElement('div');
  wrapper.className = 'dx-dartboard';

  const svg = svgEl('svg', { viewBox: '0 0 200 200', role: 'group', 'aria-label': 'FEELZ' });
  wrapper.appendChild(svg);

  // Track which path/text belongs to each emotion so we can update visual state.
  const segments = {};
  // One per active wedge — lets destroy() cancel a hold-to-listen timer
  // still pending, so it can't start a tone after the wheel is gone.
  const holdClearers = [];

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
    // The slice's picture (ui/feelingIcons.js): pixel cells that take the
    // label's fill, so applyState colors it exactly as it did the glyph.
    const label = svgEl('g', { 'pointer-events': 'none', 'shape-rendering': 'crispEdges', class: 'dx-feelz__icon' });
    label.innerHTML = iconCells(emotion, pos.x, pos.y, 2.4);

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
    if (emotion === fresh) g.classList.add('is-fresh');

    if (!isActive) return;

    let dragging = false, startX, startY, ghost;
    let holdTimer = null, previewing = false;

    function clearHold() {
      clearTimeout(holdTimer);
      holdTimer = null;
      previewing = false;
      g.classList.remove('is-previewing');
    }
    holdClearers.push(clearHold);

    let hoverTimer = null;
    g.addEventListener('pointerenter', (e) => {
      g.classList.add('is-hovering');
      audio.startFeelzHover(emotion, activeEmotionsOrder, harmonicFunction);
      if (e.pointerType === 'mouse') hoverTimer = setTimeout(() => showBody(emotion), HOLD_MS);
    });

    g.addEventListener('pointerleave', () => {
      clearTimeout(hoverTimer);
      g.classList.remove('is-hovering');
      audio.stopFeelzHover();
    });

    g.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      g.setPointerCapture(e.pointerId);
      clearHold();
      if (e.pointerType !== 'mouse') {
        holdTimer = setTimeout(() => {
          previewing = true;
          g.classList.add('is-previewing');
          // pointerenter normally started the tone already on touch; start
          // it here too in case that event didn't come through.
          audio.startFeelzHover(emotion, activeEmotionsOrder, harmonicFunction);
          audio.swellFeelzHover();
          showBody(emotion);
          feel(emotion);
        }, HOLD_MS);
      }
    });

    g.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!ghost && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        // A real drag toward the card — not a listen, even mid-swell.
        clearHold();
        ghost = document.createElement('div');
        ghost.className = 'dx-feelz__ghost';
        ghost.style.setProperty('--bubble-color', em.color);
        ghost.innerHTML = iconHtml(emotion);
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
      // Pointer capture during a drag can suppress the boundary events
      // pointerleave relies on, depending on where the gesture actually
      // ends — stop the preview here too rather than trust leave alone.
      g.classList.remove('is-hovering');
      audio.stopFeelzHover();

      const onCard = dropTarget && isOverEl(dropTarget.el, e.clientX, e.clientY);
      const wasTap = Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD;
      const wasListen = previewing;
      clearHold();

      if (wasListen) {
        // Held to listen — the tone stopped with the finger, nothing picked.
      } else if (onCard) {
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

    audio.playFeelzSelectTone(emotion, activeEmotionsOrder, harmonicFunction);
    // The screen reacts, and the first few picks of each feeling say how it
    // sits in the body (ui/feelingIcons.js).
    feel(emotion);
    showBody(emotion, { onPick: true });
    onSelect?.(emotion, source);
  }

  function reset() {
    Object.entries(segments).forEach(([em, { path, label }]) => {
      applyState(em, path, label);
    });
  }

  // A fresh feeling's entrance (CSS: scenes.css "fresh slice"): the rest of
  // the wheel dims, the slice cracks in and slams into place, a ring in its
  // color rolls out from the hub, the whole wheel pulses once.
  if (fresh && segments[fresh]) {
    wrapper.classList.add('has-fresh');
    const ring = svgEl('circle', { cx: CX, cy: CY, r: OUTER_R, class: 'dx-fresh-ring', fill: 'none' });
    ring.style.stroke = EMOTIONS[fresh].color;
    svg.appendChild(ring);
  }

  return {
    el: wrapper,
    reset,
    // A contact's read on the other person's mood (engine/contacts.js):
    // glow that slice, lit or not, without selecting it.
    hint(emotion) {
      Object.values(segments).forEach(({ g }) => g.classList.remove('is-hinted'));
      segments[emotion]?.g.classList.add('is-hinted');
    },
    // Safety net for an orphaned hover tone — the wheel getting torn down
    // (a re-render, the scene unmounting) mid-hover, before pointerleave
    // ever fires. Deliberately does NOT stop the select drone: a re-render
    // triggered by this same selectEmotion() call (dialogScene.js's
    // onSelect handler re-renders synchronously) would otherwise kill the
    // drone the instant it started. The drone's own lifetime is owned by
    // shell/audio.js (replaced on the next pick, stopped when the swipe
    // commits or the scene ends) — see docs/STAT_MATH.md.
    destroy() {
      holdClearers.forEach((clear) => clear());
      audio.stopFeelzHover();
    },
  };
}
