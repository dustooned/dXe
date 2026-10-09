# Music pipeline

How music and sound get from FL Studio into Dream Xtreme: what exists today,
what's decided, and the exact steps for each kind of sound.

**Decided 2026-10-09:** the soundtrack (battle music, OST) is **audio exported
from FL**, played as recorded. The browser's own chip/synth voices are for
**UI sounds** only (stings, blips, call tones, the wheel's feeling tones).

---

## 1. The three kinds of sound

| Kind | What it is | Made where | Plays through |
|---|---|---|---|
| **UI sounds** | Short cues: typing ticks, meter blips, ringtones, IT/SO stings, the wheel's tones, the relief chord, interval demos | Code (`src/shell/audio.js`), chip-style synth | Web Audio, live |
| **Ambient / cutscene audio** | Room tone and story beds (`lk_01.mp3`, `ann_01.mp3`, `heavens_waiting_room.mp3`) | FL or recorded, exported as audio | `public/assets/<chapter>/audio/`, played as files |
| **Battle music (OST)** | Each NPC's theme during their encounter | **FL, exported as stems** (new) | One stem player (to be built) |

UI sounds stay in code because they react live (pitch per feeling, per meter,
per class). Everything that should sound like *your* production comes from FL
as audio.

---

## 2. Battle music: the stem pipeline (decided, not built yet)

### What you export, per NPC

```
public/assets/<chapter>/music/<npc>/     e.g. public/assets/lake-ulysses/music/rwanda/
  intro.ogg      the confrontation opener
  phase1.ogg     one loop per battle phase, each at that phase's real tempo
  phase2.ogg       (each answer moves the battle one phase up)
  phase3.ogg
  phase4.ogg
  secret.ogg     the secret layer: joins when the player is close to a full connection
```

Or, instead of whole-phase loops, **layer stems** that share one tempo and
length (`drums.ogg`, `bass.ogg`, `lead.ogg`, ...), with the settings file
saying which layers play in each phase.

### Export rules (FL)

1. **OGG** (Vorbis, ~160 kbps) preferred; WAV is fine and gets converted.
2. Every loop is a **whole number of bars**, cut exactly on the bar line.
3. **No tail past the end** (turn off "leave remainder"), or the loop clicks.
4. Layer stems in a set start on the **same bar** and have the **same length**.
5. The secret layer matches the **tempo and length** of what it plays over.
6. Leave headroom; the final mix is set in the game's Sound Player.

### The settings file, per NPC

`public/assets/<chapter>/music/<npc>/music.json` (shape planned; adjust when
the player is built):

```json
{
  "bpm": { "intro": 100, "phase1": 100, "phase2": 110, "phase3": 125, "phase4": 140 },
  "bars": { "intro": 4, "phase1": 8, "phase2": 8, "phase3": 8, "phase4": 8 },
  "phases": ["phase1", "phase2", "phase3", "phase4"],
  "secret": { "file": "secret.ogg", "joinsAt": 0.6, "fadeSec": 2 },
  "volumes": { "phase1": 0.8, "secret": 0.7 },
  "nudge": 0.04
}
```

- **phases:** the loop for each step of the battle (or, with layer stems, a
  list of layers per phase: `[["drums"], ["drums", "bass"], ...]`).
- **joinsAt:** the closeness (0..1) at which the secret layer fades in.
- **nudge:** small live speed-up as tension builds (0.04 = 4%). It raises the
  pitch slightly, which reads as tension. No time-stretching: stretched stems
  drift apart.

### How the game plays it (the player to build)

- The confrontation cutscene plays `intro`; the battle starts `phase1`.
- Each answer queues the next phase; the swap happens **on the next bar line**
  so it lands on the beat.
- The secret layer fades in at `joinsAt` closeness and out if you drift away.
- `bpm` drives anything that pulses on the beat (the opponent's screen
  effects already pulse with loudness).
- When someone tells you their story, the music ducks (`encounterMusic.duck`),
  and comes back after.
- Phones: files load when the encounter's confrontation starts, not at boot.

### Steps when a new NPC's stems arrive

1. Drop the files in `public/assets/lake-ulysses/music/<npc>/`.
2. Write `music.json` (bpm and bars per loop, phases, secret).
3. Point that NPC's encounter at the stem player (one line in the chapter's
   music setup; until then, the old player or the leitmotif runs).
4. Play the encounter, open **Settings → DEBUG → SOUND PLAYER**, set levels by
   ear, COPY the numbers into `music.json`.
5. Check: loops don't click, phases swap on the beat, the secret layer fits.

---

## 3. What exists today (until stems replace it)

- **Rwanda:** her FL project is read directly (`scripts/lib/flp.mjs`,
  `npm run build:arrangement`) into `content/arrangements/rwanda.json`, and
  re-played by browser chip voices (`shell/arrangement.js`,
  `arrangementVoices.js`), with a tempo ladder by phase
  (`engine/tempoDirector.js`) and a secret part. It keeps working until her
  stems exist; then her encounter switches to the stem player.
- **Everyone else:** a short leitmotif played by chip voices, built from MIDI
  (`npm run build:leitmotifs` → `content/leitmotifs.json`).
- **Sound Player** (Settings → DEBUG): every track in memory, with levels and
  voices to tune; saves per device, COPY JSON to bake defaults.

Once every NPC has stems, the arrangement/leitmotif code can be retired for
battle music (keep the chip voices for UI sounds).

---

## 4. UI sounds (code)

All in `src/shell/audio.js`. To add one: a short function built from
`blip()` / oscillators, struck and ringing rather than droning
(see the audio-texture rule), routed through `masterGain` so volume, mute,
haze and the turn-pause all apply. Never a right/wrong sound: feedback is
atmosphere, not a score.
