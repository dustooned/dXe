# Dream Xtreme — Sound Pack

Everything about audio in this game, in one document. ~15 min read.

You never touch code. Your job is melodies (as `.mid` files) and audio
files (as `.mp3`). Everything else is wiring that already exists.

---

## The one rule

**Nothing in this game tells the player they were right or wrong.**

No sound congratulates a truth or punishes a lie. The audio reports *where
things stand*, never *how you did*. When you're deciding whether a cue is
right, that's the test: does it read as a verdict? Then it's wrong, however
good it sounds.

---

## 1. What the game is

An episodic interactive zine. You play as someone being asked hard
questions, and you answer each one with a **truth** or a **lie** — swiped
left or right on a card — after picking a **feeling** from a small wheel.

Chapter 1, "Truth Debt: Lake Ulysses," is five conversations: a Therapist
(tutorial), then Deborah, Rwanda, Samun and Rick. Each one is a
**confrontation**. Four hidden meters move as you answer, and two of them —
**trust** and **stability** — are what the music listens to.

Trust and stability are that character's *rapport and comfort with you*.
Not honesty. A comforting lie raises them. An uncomfortable truth drops
them. The music follows the relationship, not the morality. That's
deliberate.

---

## 2. The five audio layers

| Layer | What it is | Who authors it |
| :-- | :-- | :-- |
| **Leitmotifs** | One melody per character, looping under their scene | **You — MIDI** |
| **Confrontation chord** | Harmony that moves as the conversation goes | Generated (read §4) |
| **Ambient beds** | Room tone / underscore per scene | **You — MP3** |
| **One-shots** | Stings, hit sounds, typewriter ticks | **You — MP3** |
| **Title & logo** | Menu music, start jingle, studio sting | **You — MP3** |

Everything shares one output bus. Rough relative levels as currently set,
so you know what you're mixing against:

```
start jingle        0.75   ← loudest thing in the game
stings (IT, TYAGL)  0.45
typewriter tick     0.28
leitmotif           0.14   ← your melody
title music         0.13
chord root          0.11
Therapist's track   0.10
chord voices        0.08   (×3)
ambient bed         0.07   ← quietest, sits under everything
```

---

## 3. Leitmotifs — the main job

Each character gets a short looping melody that plays for their whole
scene. It's their signature. It keeps playing through their reactions.

### How to deliver one

1. Write the melody in your DAW
2. Export as `.mid`
3. Name it after the character, lowercase: `deborah.mid`, `rwanda.mid`,
   `samun.mid`, `rick.mid`
4. Send it over

That's it. Dropping it into `src/chapters/lake-ulysses/midi/` and running
`npm run build:leitmotifs` is the whole integration.

### What MIDI gives us, and what it doesn't

**Taken from your file:** pitch, rhythm, and the character's key.

**Not taken:** instrument, velocity, expression, chords.

The player is a single bare oscillator per character, so:

- **It's monophonic.** If you write a chord, only the top note survives
  (the build tells us how many notes it dropped). Write single lines.
- **Note lengths are gaps, not sustains.** Each note plays until the next
  one starts. A staccato note followed by a rest reads as one long note.
  Rests aren't silence — they're the previous note holding.
- **Timbre is picked by hand, not by your MIDI instrument.** Currently:

  | Character | Waveform | Intent |
  | :-- | :-- | :-- |
  | Deborah | sine | soft, hymn-like |
  | Rwanda | triangle | quicker, more alive |
  | Samun | square | hollow, mechanical |
  | Rick | sawtooth | harsh |

  Tell us if a melody wants a different one.

### The key matters more than you'd think

The game reads your melody and decides **which note you hold longest** —
that becomes the character's key, and the entire harmony of their
confrontation gets built on it.

**So: if your melody dwells on the fifth rather than the root, the game
will guess the wrong key** and build the whole encounter a fifth off. It
has no other way to know.

If that happens, say so and we'll pin the key by hand. It's a one-line fix.
Don't rewrite the melody to work around it.

Also: keep your accidental spelling consistent within a phrase. `Bb` and
`A#` are the same key on a piano, but the game counts them separately.
(MIDI exports are consistent by default, so this mostly bites hand-written
phrases — flagging it so you know.)

### Current state

| Character | Motif |
| :-- | :-- |
| **Deborah** | Real, from MIDI — the only one |
| Rwanda, Samun, Rick | **Placeholder** — 4–5 notes typed by hand. Replace freely |
| Therapist | Uses `heavens_waiting_room.mp3` instead. No motif |

---

## 4. The confrontation chord — what it does under your melody

You don't author this, but you're writing over it, so here's how it moves.

Underneath the melody, the game builds a **chord that reports how the
conversation is going**. The character sounds their own key as a root note.
Each of the player's three loaded feelings sounds as another voice above it.

Those voices move as the player answers:

| Where things stand | The chord |
| :-- | :-- |
| **Fully aligned** | Every voice collapses onto the root — **unison** |
| **Neutral (the start)** | Voices stacked in perfect fifths — no third, so neither major nor minor |
| **Fully detached** | Every voice on the **tritone** against a root that's still sounding |

Movement between those is by circle-of-fifths distance, and the chord walks
a **predominant → dominant → tonic** cadence across the conversation — one
fourth/fifth of root motion per stage. So a confrontation is shaped like a
cadence, and how the player did decides whether it resolves to unison or
refuses to.

Three things that matter for your writing:

1. **It's struck, not sustained.** The chord hits and rings out over ~3.5
   seconds, then silence. It is not a pad. Your melody is the only
   continuous element.
2. **It's in the character's key** — the one derived from your melody. Write
   your melody knowing the harmony will agree with it.
3. **The neutral opening is a stack of fifths.** Deliberately ambiguous. If
   you want a character to feel major or minor at rest, that has to come
   from your melody, because the chord won't supply a third.

---

## 5. The oscilloscope

During confrontations there's a live waveform drawn across the screen. It
isn't decoration — it's reading the actual audio output, so **whatever you
write is what's drawn.**

Two traces:

- **White** — real audio: your melody, the chord, stings.
- **Blue** — not audio. Synthesized from two other meters.

The white trace blurs and splits into red/blue fringing as the chord gets
more dissonant, and sharpens as it resolves. Worth knowing: as voices
converge toward unison there are genuinely fewer competing frequencies, so
the wave simplifies on its own. The picture resolves because the sound did.

Practical consequence: **a busy, wide-interval melody draws a busy trace; a
simple sustained line draws a clean one.** If a moment should look calm, it
has to sound calm.

---

## 6. Ambient beds and one-shots

### What exists now

| File | Used for | Status |
| :-- | :-- | :-- |
| `title/snd_titlemusic.mp3` + `title/snd_lake_title.mp3` | Title screen — two layers, played together | Real |
| `title/snd_start.mp3` | "Game begin" jingle | Real |
| `snd_inkflo_logo.mp3` | Studio logo sting at boot | Real |
| `heavens_waiting_room.mp3` | Therapist's scene | Real |
| `lk_01.mp3` | Bob Baiter cutscene bed | Real |
| `tyagl.mp3` | Story sting | Real |
| `it_sting.mp3` | "IT" interrupt sting | Real |
| `typewriter_tick.mp3` | Per-character text tick | Real, but see below |

### Known gaps — open commissions

- **Every confrontation has no bed.** The four confrontations and four
  mini-games run on the chord and melody alone. Biggest gap.
- **Hit sounds are bare oscillator blips** — three of them (subtle / weak /
  strong), triggered on each answer. Replacing these with real percussive
  hits would be the single most audible upgrade.
- **The typewriter tick** is pitched randomly ±12% per character to avoid
  machine-gun repetition. If you replace it, a short dry click works best.
- `ann_01.mp3` is a byte-identical duplicate of `lk_01.mp3`. Ignore it.

### Specs

**128kbps MP3.** Loops must be seamless — beds are looped with no
crossfade, so trim to the exact loop point. Full detail in
`docs/ASSET_GUIDELINES.md`.

Files go under `public/assets/`: `shared/audio/` for anything used in more
than one chapter, `lake-ulysses/audio/` for chapter-specific.

---

## 7. Where things live

```
Your MIDI            src/chapters/lake-ulysses/midi/<character>.mid
Your audio files     public/assets/lake-ulysses/audio/   (chapter)
                     public/assets/shared/audio/         (everywhere)

The audio engine     src/shell/audio.js
The music theory     src/shell/harmony.js
Full technical notes docs/STAT_MATH.md  ("Confrontation polychord")
```

---

## 8. Questions

Ask rather than working around something. If the format is fighting you —
a melody that won't fit monophonic, a key the game keeps guessing wrong, a
cue that needs to sustain — that's a limit worth changing, not one to
compose around. Most of them are a few lines to fix.
