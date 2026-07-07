import { clamp } from './util.js';

const STAT_KEYS = ['integrity', 'stability', 'lucidity', 'trust'];

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
// rendering reaction text) and a state patch to merge into the run store.
export function resolveCard(state, node, swipeKey) {
  const edge = node.swipes[swipeKey];
  const statPatch = applyStatDelta(state, edge.effects);
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
