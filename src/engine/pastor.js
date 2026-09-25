// Picks Pastor Gabriel's lines (content/pastor.json) for this player. Each
// section is a list of slots; each slot is a list of alternatives; the
// first alternative whose `when` matches plays, and a slot with no match is
// skipped. That's what lets his hints track the player: the lake's status
// *right now*, their FEELZ check-in answers, and how many lies they told.
import { statusFor } from './lake.js';

export function pastorContext(state) {
  const lies = Object.values(state.choices ?? {}).filter((side) => side === 'lie').length;
  return {
    status: statusFor(state.truthDebt),
    water: state.checkIn?.water,
    fine: state.checkIn?.fine,
    lies,
    noLedger: (state.ledger ?? []).length === 0,
  };
}

function matches(when, ctx) {
  if (!when) return true;
  if (when.status && !when.status.includes(ctx.status)) return false;
  if (when.water && !when.water.includes(ctx.water)) return false;
  if (when.fine && !when.fine.includes(ctx.fine)) return false;
  if (when.lies && (ctx.lies < when.lies[0] || ctx.lies > when.lies[1])) return false;
  if (when.noLedger !== undefined && when.noLedger !== ctx.noLedger) return false;
  return true;
}

export function pickLine(slot, ctx) {
  return (slot ?? []).find((alt) => matches(alt.when, ctx)) ?? null;
}

// Every slot of a section, resolved in order, skipping unmatched slots.
export function pickSection(section, ctx) {
  return (section ?? []).map((slot) => pickLine(slot, ctx)).filter(Boolean);
}
