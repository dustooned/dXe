// Feeling unlocks — filling the FEELZ wheel. Each NPC can give the player
// one feeling, the first on their list the player doesn't have yet, at the
// moment the player turns toward one of their bids (a shared moment: you
// feel what they feel). Lists are ordered so every class can reach 7 of 8
// by turning toward all four NPCs; the 8th, Trust, is earned separately
// (engine/trust.js).
//
//   Guns     (Anger/Fear/Sadness)      Disgust, Happy, Surprise, Anxiety
//   Bible    (Anxiety/Disgust/Fear)    Sadness, Anger, Happy, Surprise
//   Crystals (Happy/Anxiety/Surprise)  Sadness, Anger, Fear, Disgust
import { emotionsForClass } from './loadout.js';

export const GIFTS = {
  DEBORAH: ['Sadness', 'Disgust', 'Fear'],
  RWANDA: ['Anger', 'Happy'],
  SAMUN: ['Happy', 'Surprise', 'Fear'],
  RICK: ['Fear', 'Anxiety', 'Anger', 'Surprise', 'Disgust'],
};

// The feeling this NPC would give right now, or null (already gave one, or
// the player has everything on their list).
export function giftFor(npc, state) {
  if (state.giftedBy?.[npc]) return null;
  const have = emotionsForClass(state.loadout, state.unlocked ?? []);
  return (GIFTS[npc] ?? []).find((e) => !have.includes(e)) ?? null;
}
