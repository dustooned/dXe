// Ending selection by final Truth Debt (0-10 clamp). Four tiers, per
// DX Bible.md's ending set — Collapse added alongside Rick, see
// SCENE_TYPES.md / HANDOFF.md for the demo-scope history.
export function getEndingKey(truthDebt) {
  if (truthDebt <= 2) return 'CLEAN_CUT';
  if (truthDebt <= 5) return 'FUNCTIONAL_MASK';
  if (truthDebt <= 7) return 'COLLAPSE';
  return 'LIVING_LIE';
}
