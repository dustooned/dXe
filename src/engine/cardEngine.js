import { clamp } from './util.js';
import { emotionAmplifies } from './loadout.js';

const STAT_KEYS = ['integrity', 'stability', 'lucidity', 'trust'];
const AMPLIFY_MULTIPLIER = 1.5;

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

export function applyStatDelta(state, effects = {}) {
  const patch = {};
  for (const key of STAT_KEYS) {
    if (effects[key] != null) {
      patch[key] = clamp((state[key] ?? 0) + effects[key], 0, 10);
    }
  }
  return patch;
}

// Resolves a swipe against a dialog node. Returns the chosen edge (for
// rendering reaction text — effects here are always the original
// authored numbers, not the amplified ones) and a state patch to merge
// into the run store. `emotion` is optional; omitting it (or passing one
// that doesn't touch this edge's effects) behaves exactly as before
// Emotional Lean existed.
export function resolveCard(state, node, swipeKey, emotion) {
  const edge = node.swipes[swipeKey];
  const leaningEffects = applyEmotionalLean(edge.effects, emotion);
  const statPatch = applyStatDelta(state, leaningEffects);
  const truthDebt = clamp(state.truthDebt + (edge.debtDelta || 0), 0, 10);

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
