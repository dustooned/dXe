import { clamp } from './util.js';
import { emotionAmplifies } from './loadout.js';

const STAT_KEYS = ['integrity', 'stability', 'lucidity', 'trust'];
const AMPLIFY_MULTIPLIER = 1.5;
// Every truth clears the lake a little: a TRUTH edge authored with
// `DEBT: 0` actually applies this instead. Without it, debt could only
// ever rise until the Reckoning — a player who lied early had no way back
// during play. Any nonzero authored value wins, and `DEBT: 0!` (debtFixed)
// pins a truth at exactly 0.
export const TRUTH_CLEANSE = -1;
// Every lie fogs the Wi-Fi (Lucidity) a little: a LIE edge with no authored
// lucidity change applies this. Lying feels fine; you just see less clearly,
// and below 4 the Therapist won't pick up and FEELZ tips go quiet. Not in
// the tutorial (resolveCard's `fog: false`): his session is a safe place to
// try lying, and a player shouldn't leave it already cut off.
export const LIE_FOG = -1;
// Past a full lake (debt 10) a lie can't add debt, so it costs elsewhere:
// the fog thickens (Wi-Fi) and the clock slips (Integrity), one more each.
export const FULL_LAKE_COST = -1;
// The battery as a resource: at LOW_BATTERY or below FEELZ dims to save power
// (the little screen and needle go dark); at EMPTY_BATTERY your most-used
// feeling greys out too. Lies recharge it; the truth often costs charge.
export const LOW_BATTERY = 3;
export const EMPTY_BATTERY = 1;
// Switching to a different feeling on the same question costs this much.
export const SECOND_GUESS_COST = -1;

// The debt change a swipe actually applies (see TRUTH_CLEANSE).
export function effectiveDebtDelta(edge, swipeKey) {
  const authored = edge.debtDelta || 0;
  if (swipeKey === 'truth' && authored === 0 && !edge.debtFixed) return TRUTH_CLEANSE;
  return authored;
}

// Symmetric rounding (round-half-away-from-zero) so a negative delta
// amplifies just as strongly as the equivalent positive one — plain
// Math.round is asymmetric around negative .5 values.
function amplify(value) {
  const scaled = value * AMPLIFY_MULTIPLIER;
  return Math.sign(scaled) * Math.round(Math.abs(scaled));
}

function applyEmotionalLean(effects, emotion) {
  const amplifiedKey = emotionAmplifies(emotion);
  if (!amplifiedKey || effects[amplifiedKey] == null) return effects;
  return { ...effects, [amplifiedKey]: amplify(effects[amplifiedKey]) };
}

// Meters get harder to push the further out they are: inside SOFT_BAND
// (3..7) every point moves a full step; past it, moving further out takes
// two points per step (a meter heading back toward the middle never slows).
// Keeps honest players off an empty battery and liars off a full board, and
// keeps every meter moving instead of pinning at 0 or 10 by the second NPC.
export const SOFT_BAND = [3, 7];
export function softStep(value, delta) {
  let v = value;
  let budget = Math.abs(delta);
  const dir = Math.sign(delta);
  while (budget > 0) {
    const outward = dir > 0 ? v >= SOFT_BAND[1] : v <= SOFT_BAND[0];
    const cost = outward ? 2 : 1;
    if (budget < cost) break;
    budget -= cost;
    v += dir;
  }
  return clamp(v, 0, 10);
}

export function applyStatDelta(state, effects = {}) {
  const patch = {};
  for (const key of STAT_KEYS) {
    if (effects[key] != null) {
      patch[key] = softStep(state[key] ?? 0, effects[key]);
    }
  }
  return patch;
}

// Rest after each encounter (the walk to the next one), battery only: how
// people feel about you, how clearly you see and your honest clock don't
// heal on a walk. The Therapist told you to rest; this is it.
//   connected  being let in charges you: +REST_CONNECTED, past the middle too
//              (soft-capped like any gain)
//   otherwise  you walk it off: up to REST_WALK back toward 5, never down
export const REST_WALK = 2;
export const REST_CONNECTED = 3;
export function restAfter(state, { connected = false } = {}) {
  const v = state.stability ?? 5;
  const next = connected ? softStep(v, REST_CONNECTED) : v < 5 ? Math.min(5, v + REST_WALK) : v;
  return { stability: next };
}

// Resolves a swipe against a dialog node. Returns the chosen edge (for
// rendering reaction text — effects here are always the original
// authored numbers, not the amplified ones) and a state patch to merge
// into the run store. `emotion` is optional; omitting it (or passing one
// that doesn't touch this edge's effects) behaves exactly as before
// Emotional Lean existed.
export function resolveCard(state, node, swipeKey, emotion, { fog = true } = {}) {
  const edge = node.swipes[swipeKey];
  const authored = edge.effects ?? {};
  let effects = fog && swipeKey === 'lie' && authored.lucidity == null ? { ...authored, lucidity: LIE_FOG } : authored;
  if (fog && swipeKey === 'lie' && (state.truthDebt ?? 0) >= 10) {
    effects = { ...effects, lucidity: (effects.lucidity ?? 0) + FULL_LAKE_COST, integrity: (effects.integrity ?? 0) + FULL_LAKE_COST };
  }
  const leaningEffects = applyEmotionalLean(effects, emotion);
  const statPatch = applyStatDelta(state, leaningEffects);
  const truthDebt = clamp(state.truthDebt + effectiveDebtDelta(edge, swipeKey), 0, 10);

  const ledger = edge.ledgerEntry
    ? [
        ...state.ledger,
        {
          nodeId: node.id,
          npc: node.npc,
          location: node.location,
          ledgerText: edge.ledgerEntry,
          debtDelta: edge.debtDelta || 0,
          tags: edge.tags || [],
        },
      ]
    : state.ledger;

  return {
    edge,
    patch: { ...statPatch, truthDebt, ledger },
  };
}

const GATE_COMPARATORS = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
};

// Meter-gated branching (docs/STAT_MATH.md): a node can carry an opt-in
// `gate` — if its condition is met, redirect to `gate.elseNodeId` instead
// of showing this node. Nodes without a `gate` are returned unchanged, so
// this is a no-op for all existing content until a node explicitly opts
// in. Called with the node id you *intended* to show; returns the id you
// should actually show.
export function resolveGatedNode(nodeId, npc, state) {
  const node = npc.nodes[nodeId];
  const gate = node?.gate;
  if (!gate) return nodeId;
  const compare = GATE_COMPARATORS[gate.op];
  const current = state[gate.stat] ?? 0;
  return compare(current, gate.value) ? gate.elseNodeId : nodeId;
}
