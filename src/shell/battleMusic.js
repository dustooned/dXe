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
  for (const st of [...director.config.states, { id: 'early', section: director.config.earlySection }]) {
    if (!known.has(st.section)) throw new Error(`tempo state "${st.id}" wants section "${st.section}", which "${data.id}" doesn't have`);
  }

  let unsubscribe = null;
  let lastSection = null;
  let lastBpm = null;
  let secretOn = false;

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
      secretOn = false;
      player.setSecret(false, 0.01);
      lastSection = section ?? s.section;
      lastBpm = s.targetBpm;
      player.start({ section: lastSection, bpm: s.targetBpm });
      unsubscribe = director.subscribe(follow);
      return s;
    },
    // How close the player is to a full connection (0..1, the scope's
    // closeness). Near it, the secret track fades in — a sign they're almost
    // there; it fades back out only if they drift well away again.
    setCloseness(c) {
      const { secretAt, secretHysteresis } = director.config;
      if (!secretOn && c >= secretAt) secretOn = true;
      else if (secretOn && c < secretAt - secretHysteresis) secretOn = false;
      player.setSecret(secretOn, 4);
      return secretOn;
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
