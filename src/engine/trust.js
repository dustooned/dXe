// Trust — separate from Truth. Truth is the lake (did you say what's real);
// Trust is whether a person can rely on you. See docs/GAME_MANUAL.md's
// "Trust" for the design. Built per NPC from two authored signals:
//
//   attunement    the player's FEELZ pick matched the node's MOOD
//   turning toward the player's answer was one of the node's BID sides
//
// Consistency, the third behavior, lives in dialogScene.js: an answer
// with CONTRADICTS: that matches something said to someone earlier costs
// this NPC a sync, and IT quotes the earlier line back.
//
// run.bonds shape: { [npc]: { syncs: n, bids: n } }. Named bonds, not
// trust, because run.trust is already the TRU meter (a number).

// What it takes for one NPC to trust you, and how many trusted NPCs it
// takes to unlock the Trust feeling.
export const SYNCS_NEEDED = 2;
export const BIDS_NEEDED = 1;
export const TRUSTED_TO_UNLOCK = 2;

export function recordTrust(bonds, npc, { synced, turnedToward }) {
  const prev = bonds[npc] ?? { syncs: 0, bids: 0 };
  return {
    ...bonds,
    [npc]: { syncs: prev.syncs + (synced ? 1 : 0), bids: prev.bids + (turnedToward ? 1 : 0) },
  };
}

export function isTrusted(entry) {
  return !!entry && entry.syncs >= SYNCS_NEEDED && entry.bids >= BIDS_NEEDED;
}

export function trustedCount(bonds = {}) {
  return Object.values(bonds).filter(isTrusted).length;
}

// True the moment the run first qualifies for the Trust feeling.
export function shouldUnlockTrust(state) {
  return !state.unlocked?.includes('Trust') && trustedCount(state.bonds) >= TRUSTED_TO_UNLOCK;
}
