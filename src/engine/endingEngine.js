// Ending selection by final Truth Debt (0-10 clamp). Four tiers, per
// DX Bible.md's ending set — Collapse added alongside Rick, see
// SCENE_TYPES.md / HANDOFF.md for the demo-scope history.
export function getEndingKey(truthDebt) {
  if (truthDebt <= 2) return 'CLEAN_CUT';
  if (truthDebt <= 5) return 'FUNCTIONAL_MASK';
  if (truthDebt <= 7) return 'COLLAPSE';
  return 'LIVING_LIE';
}

const EPILOGUE_STAT_KEYS = ['integrity', 'trust', 'stability', 'lucidity'];
const STAT_BASELINE = 5;

// The ending epilogue (docs/STAT_MATH.md): whichever of the four meters
// ended up furthest from its starting value gets named at the ending.
// The only thing currently reading the four meters back — everything
// else about the ending is decided by Truth Debt alone.
export function getEpilogueStat(state) {
  let winner = EPILOGUE_STAT_KEYS[0];
  let winnerDeviation = -1;
  for (const key of EPILOGUE_STAT_KEYS) {
    const deviation = Math.abs((state[key] ?? STAT_BASELINE) - STAT_BASELINE);
    if (deviation > winnerDeviation) {
      winnerDeviation = deviation;
      winner = key;
    }
  }
  return winner;
}
