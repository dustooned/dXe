import { clamp } from './util.js';

// The altar call is scrupulosity: confession never quite finishes the job.
// So each card moves the lake a little, not all the way, and a deep lake
// can't be confessed clean in three taps:
//  - CONFESS clears about half of what that lie added (1 to 3).
//  - DOUBLE DOWN adds 1 or 2 (2 for the bigger lies).
//  - Confessing can't take the lake below a third of where it stood when
//    the altar call began (rounded up). A shallow lake can still go clean;
//    a full one tops out at a functional mask.
// The ending reads the run first and the Reckoning second: three taps shift
// it by a tier or so, they don't decide it.
export const CONFESS_MAX = 3;
export const DOUBLE_DOWN_SMALL = 1;
export const DOUBLE_DOWN_BIG = 2;
const BIG_LIE = 5; // a lie that added this much debt or more

// Builds the Reckoning deck from the run's ledger — most recent lies first,
// capped at 3 cards for the demo (DX_DEMO_BUILD_SPEC.md section 1.1).
// startDebt is the lake as the altar call begins (sets the confession floor).
export function buildReckoningDeck(ledger, maxCards = 3, startDebt = 0) {
  const floor = Math.ceil(startDebt / 3);
  return [...ledger]
    .slice(-maxCards)
    .reverse()
    .map((entry, i) => {
      const payoff = Math.abs(entry.debtDelta) || 1;
      return {
        id: `reckoning_${i}`,
        npc: entry.npc,
        ledgerText: entry.ledgerText,
        tags: entry.tags,
        payoff,
        floor,
        clears: Math.min(CONFESS_MAX, Math.max(1, Math.ceil(payoff / 2))),
        adds: payoff >= BIG_LIE ? DOUBLE_DOWN_BIG : DOUBLE_DOWN_SMALL,
      };
    });
}

export function resolveReckoningCard(state, card, choice) {
  const debt = state.truthDebt ?? 0;
  const delta = choice === 'confess'
    ? -Math.min(card.clears ?? CONFESS_MAX, Math.max(0, debt - (card.floor ?? 0)))
    : card.adds ?? DOUBLE_DOWN_BIG;
  return { patch: { truthDebt: clamp(debt + delta, 0, 10) } };
}
