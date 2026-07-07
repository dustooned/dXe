import { clamp } from './util.js';

const DOUBLE_DOWN_PENALTY = 3;

// Builds the Reckoning deck from the run's ledger — most recent lies first,
// capped at 3 cards for the demo (DX_DEMO_BUILD_SPEC.md section 1.1).
export function buildReckoningDeck(ledger, maxCards = 3) {
  return [...ledger]
    .slice(-maxCards)
    .reverse()
    .map((entry, i) => ({
      id: `reckoning_${i}`,
      npc: entry.npc,
      ledgerText: entry.ledgerText,
      tags: entry.tags,
      payoff: Math.abs(entry.debtDelta) || 1,
    }));
}

export function resolveReckoningCard(state, card, choice) {
  const delta =
    choice === 'confess' ? -card.payoff : DOUBLE_DOWN_PENALTY;
  const truthDebt = clamp(state.truthDebt + delta, 0, 10);
  return { patch: { truthDebt } };
}
