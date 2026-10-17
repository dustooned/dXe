// The delivery spectrum (Phase 11, docs/PHASE_11.md step 7): on a node that
// authors it (manuscript -- SOFT / -- BAIT, a LIE's WHITE REACT:), how far
// you push the card picks how you say it.
//
//   left,  short push   SOFT TRUTH   the true thing, said kindly
//   left,  full push    HARSH TRUTH  the authored TRUTH, as written
//   right, short push   WHITE LIE    the authored LIE, lands gently while the
//                                    budget lasts; one too many lands like the
//                                    full authored lie
//   right, full push    BAIT         a lie thrown to provoke them into the
//                                    truth; bounces off if they don't trust
//                                    you enough to take the hit
//
// Each one is built as an ordinary card edge, so contradictions, bids, the
// lake, the ledger and every reaction system read it like any other answer.
// The NPC's GUARD (manuscript GUARD:) is what the delivery is aimed at: at
// MASK_SLIP_AT their mask slips, at 0 the truth comes out (their STORY,
// dialogScene.js). Numbers are shown while dragging, unless a status ailment
// hides them (hasAilment). None of it is a verdict: every row is a trade.
import { resolveCard, LOW_BATTERY, EMPTY_BATTERY } from './cardEngine.js';
import { FOG_WIFI } from './contacts.js';

export const WHITE_BUDGET = 2;     // white lies per encounter before one lands heavy
export const BAIT_MIN_BARS = 4;    // bars below this and a bait bounces off
export const MASK_SLIP_AT = 3;     // guard at or under this: the mask slips
export const CLOCK_GLITCH = 2;     // clock at or under this scrambles (statusBar.js)

// Battery is the energy to say hard things (Phase 11 rebalance): a harsh truth
// costs one more battery than authored, a bait costs one, and with the battery
// at EMPTY_BATTERY or below you can't push all the way (tooTired): only the
// short pushes, soft truth and white lie, are left.
export const HARSH_EXTRA_COST = -1;
export const BAIT_COST = -1;
export function tooTired(state) {
  return (state?.stability ?? 5) <= EMPTY_BATTERY;
}

export const GUARD_DELTA = { harsh: -2, soft: -1, white: -1, whiteOver: 1, bait: -3, baitFail: 2 };
const SOFT_EFFECTS = { integrity: 1, lucidity: 1, trust: 1 };
// lucidity: 0 on purpose: a white lie doesn't fog the Wi-Fi (cardEngine.js LIE_FOG).
const WHITE_EFFECTS = { stability: 1, trust: 1, lucidity: 0 };
const WHITE_DEBT = 1;
const BAIT_EFFECTS = { trust: -2, stability: BAIT_COST };
const BAIT_DEBT = 3;

export const DELIVERY_LABELS = { harsh: 'HARSH TRUTH', soft: 'SOFT TRUTH', white: 'WHITE LIE', bait: 'BAIT' };

export function hasDelivery(node) {
  return !!(node?.delivery?.soft && node.delivery.bait && node.swipes?.truth && node.swipes?.lie);
}

export function deliveryKind(swipeKey, hard) {
  if (swipeKey === 'truth') return hard ? 'harsh' : 'soft';
  return hard ? 'bait' : 'white';
}

// A status ailment hides the numbers: low battery (FEELZ dims), fogged Wi-Fi,
// a scrambling clock, or being shut out (airplane mode). The clock's mild
// slip, lie haze and low bars don't count: nearly everyone has those.
export function hasAilment(state, { shutOut = false } = {}) {
  return (state.stability ?? 5) <= LOW_BATTERY
    || (state.lucidity ?? 5) < FOG_WIFI
    || (state.integrity ?? 5) <= CLOCK_GLITCH
    || shutOut;
}

// The answer as a card edge. ctx: { whiteUsed, trust, baitFail (lines), pick (0..1) }.
// Returns { kind, swipeKey, edge, guardDelta, bidKey, over, bounced }.
export function buildDelivery(node, kind, { whiteUsed = 0, trust = 5, baitFail = [], pick = Math.random() } = {}) {
  const truth = node.swipes.truth;
  const lie = node.swipes.lie;
  const d = node.delivery;
  if (kind === 'harsh') {
    const edge = { ...truth, effects: { ...truth.effects, stability: (truth.effects?.stability ?? 0) + HARSH_EXTRA_COST } };
    return { kind, swipeKey: 'truth', edge, guardDelta: GUARD_DELTA.harsh, bidKey: 'truth' };
  }
  if (kind === 'soft') {
    const edge = {
      ...truth,
      playerText: d.soft.playerText,
      npcReaction: d.soft.npcReaction,
      reactByClass: d.soft.reactByClass,
      effects: SOFT_EFFECTS,
      debtDelta: 0,
      debtFixed: false,
      tags: [],
      ledgerEntry: null,
    };
    return { kind, swipeKey: 'truth', edge, guardDelta: GUARD_DELTA.soft, bidKey: 'truth' };
  }
  if (kind === 'white') {
    if (whiteUsed >= WHITE_BUDGET) {
      return { kind, swipeKey: 'lie', edge: lie, guardDelta: GUARD_DELTA.whiteOver, bidKey: 'lie', over: true };
    }
    const edge = {
      ...lie,
      npcReaction: d.white?.npcReaction ?? lie.npcReaction,
      reactByClass: d.white ? undefined : lie.reactByClass,
      effects: WHITE_EFFECTS,
      debtDelta: WHITE_DEBT,
      tags: [],
      ledgerEntry: null,
    };
    return { kind, swipeKey: 'lie', edge, guardDelta: GUARD_DELTA.white, bidKey: 'lie' };
  }
  // Bait: lands (the truth path opens) or bounces (they dig in, the lie path).
  const bounced = trust < BAIT_MIN_BARS;
  const fail = baitFail.length ? baitFail[Math.floor(pick * baitFail.length) % baitFail.length] : d.bait.npcReaction;
  const edge = {
    playerText: d.bait.playerText,
    npcReaction: bounced ? fail : d.bait.npcReaction,
    reactByClass: bounced ? undefined : d.bait.reactByClass,
    effects: BAIT_EFFECTS,
    debtDelta: BAIT_DEBT,
    tags: ['Manipulation'],
    ledgerEntry: d.bait.ledgerEntry ?? null,
    nextNodeId: bounced ? lie.nextNodeId : truth.nextNodeId,
  };
  // Not a bid: provoking someone isn't turning toward them.
  return { kind, swipeKey: 'lie', edge, guardDelta: bounced ? GUARD_DELTA.baitFail : GUARD_DELTA.bait, bidKey: null, bounced };
}

// What a delivery would do, in the numbers the player sees: each meter's
// real change (after soft caps, the feeling's lean and effort), the lake and
// the guard. ctx as buildDelivery, plus guard (current).
export function previewDelivery(state, node, kind, emotion, ctx = {}) {
  const built = buildDelivery(node, kind, { ...ctx, trust: state.trust ?? 5, pick: 0 });
  const virtual = { ...node, swipes: { [built.swipeKey]: built.edge } };
  const { patch } = resolveCard(state, virtual, built.swipeKey, emotion);
  const meters = {};
  for (const k of ['integrity', 'stability', 'lucidity', 'trust']) {
    const delta = (patch[k] ?? state[k]) - state[k];
    if (delta) meters[k] = delta;
  }
  return {
    kind,
    label: DELIVERY_LABELS[kind],
    meters,
    lake: (patch.truthDebt ?? state.truthDebt) - (state.truthDebt ?? 0),
    guard: built.guardDelta,
    over: !!built.over,
    bounced: !!built.bounced,
  };
}

// The strip under the card: the label, then each change, or "? ? ?".
const METER_WORDS = { integrity: 'CLOCK', stability: 'BATTERY', lucidity: 'WI-FI', trust: 'BARS' };
const sign = (n) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));
export function previewText(p, { hidden = false } = {}) {
  const head = p.over ? `${p.label} · ONE TOO MANY` : p.bounced ? `${p.label} · WON'T LAND` : p.label;
  if (hidden) return { head, parts: ['? ? ?'] };
  const parts = Object.entries(p.meters).map(([k, v]) => `${METER_WORDS[k]} ${sign(v)}`);
  if (p.lake) parts.push(`LAKE ${sign(p.lake)}`);
  parts.push(`GUARD ${sign(p.guard)}`);
  return { head, parts };
}
