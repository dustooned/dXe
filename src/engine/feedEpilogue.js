// The morning-after feed (Phase 11 step 5, phase 3): after the ending, the
// FEELZ feed comes back and each channel shows the version that matches the
// run. content/feed_epilogue.json lists, per channel id, variants in order;
// the first whose `when` holds plays (a variant with no `when` always does).
//
// when: {
//   ending: ['CLEAN_CUT', ...]   the ending reached (by the final lake)
//   trusted: 'DEBORAH'           that NPC came to trust you (engine/trust.js)
//   story: 'DEBORAH'             you heard their STORY
//   shutDown: 'RICK'             they shut you out (a _shut_down/_closed node)
//   guardBroken: 'SAMUN'         their guard hit 0 (engine/delivery.js)
//   baptism: 'confess' | 'down'  what you mostly did at the Reckoning
// }
// {lies} in a line is how many lies you told this run.
import { getEndingKey } from './endingEngine.js';
import { isTrusted } from './trust.js';

export function epilogueFacts(state) {
  const choices = state.choices ?? {};
  const rc = state.reckoningChoices ?? [];
  const confessed = rc.filter((c) => c === 'confess').length;
  return {
    ending: getEndingKey(state.truthDebt ?? 0),
    lies: Object.values(choices).filter((c) => c === 'lie').length,
    trusted: new Set(Object.entries(state.bonds ?? {}).filter(([, b]) => isTrusted(b)).map(([npc]) => npc)),
    story: new Set(state.storiesHeard ?? []),
    shutDown: new Set(Object.keys(choices).filter((id) => /_(shut_down|closed)$/.test(id)).map((id) => id.split('_')[0].toUpperCase())),
    guardBroken: new Set(Object.entries(state.guard ?? {}).filter(([, g]) => g === 0).map(([npc]) => npc)),
    baptism: rc.length ? (confessed * 2 >= rc.length ? 'confess' : 'down') : null,
  };
}

export function epilogueMatches(when, facts) {
  if (!when) return true;
  if (when.ending && !when.ending.includes(facts.ending)) return false;
  if (when.trusted && !facts.trusted.has(when.trusted)) return false;
  if (when.story && !facts.story.has(when.story)) return false;
  if (when.shutDown && !facts.shutDown.has(when.shutDown)) return false;
  if (when.guardBroken && !facts.guardBroken.has(when.guardBroken)) return false;
  if (when.baptism && when.baptism !== facts.baptism) return false;
  if (when.liesZero != null && (facts.lies === 0) !== when.liesZero) return false;
  return true;
}

// Each channel's beats for this run, with {lies} filled in. Channels with no
// matching variant are left out.
export function pickEpilogue(channels, facts) {
  return channels.flatMap((ch) => {
    const v = ch.variants.find((x) => epilogueMatches(x.when, facts));
    if (!v) return [];
    const fill = (t) => String(t).replaceAll('{lies}', String(facts.lies));
    return [{ id: ch.id, variant: ch.variants.indexOf(v), beats: v.beats.map((b) => ({ ...b, text: fill(b.text), comments: (b.comments ?? []).map((c) => ({ ...c, text: fill(c.text) })) })) }];
  });
}
