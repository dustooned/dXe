import { clamp } from './util.js';

// The altar call is scrupulosity: confession never quite finishes the job.
// So each card moves the lake a little, not all the way, and a deep lake
// can't be confessed clean in three taps:
//  - CONFESS clears about half of what that lie added (1 to 3).
//  - DOUBLE DOWN adds 1 or 2 (2 for the bigger lies).
//  - Confessing can't take the lake below a third of where it stood when
//    the altar call began (rounded up). A shallow lake can still go clean;
//    a full one tops out at a functional mask, however many cards there are.
// The ending reads the run first and the Reckoning second: a handful of taps
// shift it by a tier or so, they don't decide it.
export const CONFESS_MAX = 3;
export const DOUBLE_DOWN_SMALL = 1;
export const DOUBLE_DOWN_BIG = 2;
const BIG_LIE = 5; // a lie that added this much debt or more

// Builds the Reckoning deck from the run's ledger, most recent lies first:
// up to maxCards cards. A ledger longer than that keeps its newest
// (maxCards - 1) lies as their own cards and puts every older one on a last
// card that names them all, priced on their combined weight with the same
// rules (so a long run of lies faces more of them, not the same few).
// startDebt is the lake as the altar call begins (sets the confession floor).
export function buildReckoningDeck(ledger, maxCards = 5, startDebt = 0) {
  const floor = Math.ceil(startDebt / 3);
  let cards = [...ledger].reverse();
  if (cards.length > maxCards) {
    const older = cards.slice(maxCards - 1);
    cards = [...cards.slice(0, maxCards - 1), {
      npc: older[0].npc,
      ledgerText: [...older].reverse().map((e) => e.ledgerText).join(' '),
      tags: [...new Set(older.flatMap((e) => e.tags ?? []))],
      debtDelta: older.reduce((sum, e) => sum + Math.abs(e.debtDelta || 0), 0),
      grouped: older.length,
    }];
  }
  return cards
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
