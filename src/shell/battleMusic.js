// Battle music: the tempo director's decisions played by the arrangement
// player. The director (engine/tempoDirector.js) turns battle events into a
// target BPM and a section; this just hands those to the player without ever
// restarting it. A new battle starts a fresh clock at the encounter's tempo.
//
//   const music = createBattleMusic(arrangementJson);
//   music.start({ bpm: 90 });          // from a user gesture; bpm optional
//   music.director.tensionIncreased();  // ...any director event
//   music.end();
import { createArrangementPlayer } from './arrangement.js';
import { createTempoDirector } from '../engine/tempoDirector.js';
import { getTuning } from './soundTuning.js';

export function createBattleMusic(data, tuning = getTuning(data.id)) {
  const player = createArrangementPlayer(data, { tuning });
  const director = createTempoDirector(tuning.tempo ?? {});
  const known = new Set(player.sectionIds());
  for (const st of director.config.states) {
    if (!known.has(st.section)) throw new Error(`tempo state "${st.id}" wants section "${st.section}", which "${data.id}" doesn't have`);
  }

  let unsubscribe = null;
  let lastSection = null;
  let lastBpm = null;

  function follow(s) {
    if (!player.playing || !s.active) return;
    const { rampSeconds, quantize, sectionQuantize } = director.config;
    if (s.section !== lastSection) {
      lastSection = s.section;
      player.queueSection(s.section, sectionQuantize);
    }
    if (Math.abs(s.targetBpm - lastBpm) > 0.01) {
      lastBpm = s.targetBpm;
      player.setBpm(s.targetBpm, { rampSec: rampSeconds, quantize });
    }
  }

  return {
    player,
    director,
    // Begin a battle (call from a user gesture — it starts audio).
    // `section` opens on that section instead of the director's own (the
    // confrontation's intro); the director then moves it on from there.
    start({ section, ...battle } = {}) {
      unsubscribe?.();
      player.stop({ fade: 0.05 });
      const s = director.battleStarted(battle);
      lastSection = section ?? s.section;
      lastBpm = s.targetBpm;
      player.start({ section: lastSection, bpm: s.targetBpm });
      unsubscribe = director.subscribe(follow);
      return s;
    },
    // The confrontation is over and the battle begins: a fresh emotional
    // state, and the director takes the music from the intro onward.
    engage(battle = {}) {
      return director.battleStarted(battle);
    },
    end({ fade } = {}) {
      unsubscribe?.();
      unsubscribe = null;
      director.battleEnded();
      player.stop(fade ? { fade } : {});
    },
  };
}
