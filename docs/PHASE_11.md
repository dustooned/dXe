# Phase 11 plan: JT & Sarina playtest (2026-10-11)

Source: `dXe_Test_Review_JT&Sarina_10.11.2026.md`. Plan only, nothing built yet.
Item numbers match the review. Ordered by dependency and size, not by review number.

## Status (2026-10-16)
- DONE: Toback outline, colorblind mode, Rwanda GIFs (Neutral + Neutral01 saved and verified; Neutral02-04 not yet: the Drive download returned data that didn't match their file sizes, re-download or drop them in by hand).
- DONE (first pass): demo-as-tutorial. Opening call cut to the app basics; lesson calls on Deborah (battle), Rwanda (little screen), Samun (mask, then the lie trade), none on Rick.
- DONE: Samun delivery spectrum (step 7): soft/harsh truth, white lie, BAIT (the combative full-push lie, chosen 2026-10-16); numbers strip hidden by status ailments; guard meter.
- DONE (phase 1 of 3): FEELZ install + the feed (step 5): install scene, feed engine, Bob (original script), FEELZ ad, Widow's Grade doc. First run must visit every channel to close.
- DONE: feed phase 2: Pastor, Rick, Rwanda, Samun channels (7 in all), placeholder pictures.
- NEXT: feed phase 3 (epilogue rerun that reflects the run); channel art; first choices (6); QR save (8); the spectrum for Rick.

## Revision 1 (2026-10-16): your answers change steps 2, 4, 7, 8

**Rwanda (step 2).** Drive has only her 5 neutral profile GIFs (`NPCs/Rwanda`, from Jules); no script or text. The repo's `rwanda.json` and her confrontation read clean to me, so the typo is still unlocated. Her GIFs are not in `art-import/` yet. Need: the typo's wording (or a screenshot) and a yes to download the 5 GIFs into `art-import/rwanda/`.

**Steps 4 + 7 merge into one: the demo IS the tutorial.** Each NPC round teaches exactly one mechanic, in the same rhythm every time, so the first playthrough is the full lesson and nothing else is needed (the Therapist's long spotlight tutorial goes away).

| Round | Teaches | Bob/Therapist role |
|-------|---------|--------------------|
| Deborah | Swipe truth/lie, the four batteries (integrity, lucidity, stability, trust), the lake gauge | Therapist call, 1-2 lines; replaces the old battle tutorial |
| Rwanda | The FEELZ wheel + scope: feel with someone, stillness/attunement; truth warms her | Therapist 1 line |
| Samun | **Delivery spectrum** (harsh truth, soft truth, white lie, harmful lie) + goal "get the truth out of him" | Therapist 1 line |
| Rick | Everything at once; meter gates (shut down below trust 3) | none, you're on your own |

Round rhythm (identical each time, predictable on purpose):
1. **Setup:** one-line Therapist call naming the new tool.
2. **Guided node:** the new mechanic is highlighted, one clear option, no penalty for experimenting (non-judgmental feedback).
3. **Free nodes:** you use it against the NPC, previous tools still live.
4. **Debrief:** lake and fish react; a one-line "what just changed".

Replay incentive (keeps it a fast second run): different class (3 starts), 4 endings shown as ??? chips, secret music layer, unlock history in the QR record (step 8), and each NPC's second route (e.g. Samun answers differently to soft truth vs white lie).

Consequence: step 5 (Bob Baiter) shrinks to the FEELZ install moment before the Deborah round, and step 6 (first choices) is the intake plus Deborah's guided node. The Samun system is no longer a prototype: it is built in full, with Samun as its teaching round, and the delivery spectrum can then be authored for Rick too.

**QR / save (step 8), proposal.** The QR is a link: `dreamxtre.me/#r=<compact run data>`. The data lives after the `#`, so it never reaches a server, needs no backend, and works offline as a save code.
- **Lost your save:** open the link or scan the QR, or paste/import the downloaded save file, and the game restores unlocks, endings seen and run history.
- **Share:** the same link opens a read-only "run card" for a friend (class, ending, the stats that moved) with an optional "start your own". They do not inherit your unlocks unless they choose import.
- Size: unlocks + history packed as bytes is a few hundred bytes, well inside one QR.
- No personal data; a checksum catches typos/corruption, not cheating (cheating a local single-player demo is acceptable).
- Needs: vendored QR encoder (small), a decoder path via the link (no camera needed; phone cameras open the link natively).

## Order of work (original; see revision above for merges)

| # | Step | Review item | Size | Why here |
|---|------|-------------|------|----------|
| 1 | Toback quote outline | 2 | XS | Pure CSS, ships immediately |
| 2 | Rwanda typo + lie-still incentive | 6 | S | Small content pass, needs your input on the typo |
| 3 | Colorblind mode | 1 | M | Settings + a rule every later feature must follow |
| 4 | Tutorial rework (shorter, UI/FEELZ focus, battle tutorial moves to Deborah) | 5 | L | Everything after this assumes the new onboarding |
| 5 | FEELZ install cutscene + Bob Baiter live feed | 3 | L | Replaces the infodump; sits right after the tutorial's FEELZ intro |
| 6 | First choices that matter + sensory layer | 4 | M | Needs the new opening flow from 4-5 to place the choices |
| 7 | Samun: white lie / soft truth system | 7 | XL | Biggest design item; new mechanic. Prototype on Samun only |
| 8 | Ending: unique QR per run + local history | 8 | L | Independent; last because it reads the final state of everything |

Steps 1-3 are independent and can run in parallel. 4 before 5 before 6. 7 and 8 are independent of each other.

---

## 1. Toback quote: outline behind the text (item 2)
- Where: `content/opening_quote.json` beats use `bgAnim: quote_bg`; text styled in `cutsceneScene.js` / `scenes.css`.
- Do: black stroke/halo behind the narration text on these beats (stacked `text-shadow` or `-webkit-text-stroke` + `paint-order: stroke`). Calc-unit rule applies to sizes. Match series style: no glows, flat black outline on white text.
- Done when: readable over every frame of the 5-frame BG at 320 and 1920 wide, REDUCE EFFECTS unaffected.
- **Open:** is the problem contrast over the bright frames, or the BG art being too busy? (If busy, also dim the BG ~30%.)

## 2. Rwanda (item 6)
- **Typo:** need the location. Plan: grep `rwanda.json`, `confront_rwanda.json`, `rwanda-alley.js`, her marker/plate and manuscript for misspellings, and list candidates.
- **No incentive to lie still:** I read this as the alley minigame (and/or her battle) giving no reason to stay still. Proposal: staying still builds a visible "calm" reading (scope settles, her weather clears a little, small trust gain on a held beat), and moving costs nothing but forfeits that. Must stay non-judgmental per [feedback: atmospheric, never right/wrong]: reward as atmosphere, not a score.
- **Open:**
  1. Where exactly is the typo?
  2. Is "lie still" the alley minigame, or a dialog where you could lie to her? (Rwanda only warms to truth by design, so a lie incentive would contradict that.)
  3. What should staying still earn: trust, a secret-track layer, a line from her, or just feel?

## 3. Colorblind mode (item 1)
- The game leans on feeling colors (`{color:Fear}`), the wheel, class colors, lake gauge, meters. Color is often the only signal.
- Do: Settings > COLORBLIND with three palettes (protanopia/deuteranopia, tritanopia, off) swapping the CSS color tokens; plus a non-color channel: feeling icons already exist (`feelingIcons.js`), so ensure every colored feeling word, wheel slice and meter also shows its icon or a pattern/label. Add a rule to HANDOFF: color never carries meaning alone.
- Verify with a CVD simulation screenshot pass of the wheel, dialog, lake and ending.
- **Open:** palette swap, patterns/icons, or both? Is a full-screen filter (cheap, imprecise) acceptable as v1?

## 4. Therapist tutorial rework (item 5)
- Current: long spotlight tutorial + science of the scope + class metaphors (~5 extra taps) + intake read. Content in `therapist.json`, `therapist_01`.
- Do:
  - **Cut length.** Move the science-of-the-scope and class metaphor to an optional "tell me more" (or to a later call).
  - **Refocus on UI:** FEELZ app, Truth vs Lie card, and the four battery statuses (meters). Short, one idea per screen, interactive (player does the thing) rather than told.
  - **Move the battle tutorial** (wheel + scope as a fight) into Deborah's first encounter: the Therapist coaches by phone call during her first node, so the lesson lands when it matters. Keeps "Therapist early only" (this is early game).
- Done when: first-time player reaches Deborah in a target of N taps (set after measuring the current count).
- **Open:** target tap count/time? Keep the class metaphors anywhere, or cut? What does "Truth and Lie, Battery Statuses" mean precisely: the card swipe plus the four meters (integrity, lucidity, stability, trust)?

## 5. Bob Baiter: interactive, not an infodump (item 3)
- Current: `bob_baiter.json` is a 10-frame animated cutscene of announcements, ~6.5KB of text.
- **5a. Pre-cut scene on FEELZ install** (`feelz_launch.json` leads to Bob): the player does something: the install is a short interactive bit (hold to install, tap permission toggles the app jokes about, pick a username) ending as the app hijacks to Bob Baiter. The player's input changes Bob's lines a little (e.g. his greeting uses the name).
- **5b. TikTok-style live comment feed during Bob's broadcast:** comments scroll up the side, fake viewers react to what Bob says; the player can tap a comment to react/heart/pin one. Drops the long announcement into short beats with comments carrying the humor and the information (bait shop, biohazard, pets, exposure, fish symbols).
- Data: new `bob_comments.json` (writer-friendly, same manuscript pipeline), comments timed to beats; a few reactive to the player's choices.
- **Open:** do comments affect anything (e.g. the lake, trust in FEELZ) or only engagement? Tap-to-react a free action, or does it cost something? Writer needed for ~40-60 comments: first drafts by me?

## 6. First choices matter (item 4)
- Today the first choices (questionnaire, class pick, early FEELZ choices) feel inert. Do:
  - Make the first 2-3 choices set a visible, persistent state: a starting Emotional Lean/line in Deborah's dialog, a starting lake tint, a fish behavior, and an "echo" line later that references it.
  - **Sensory eye candy:** each first choice triggers an interactive visual/sound moment (ripple on the lake, the fish reacting, dithered particle bloom, a tone from the player's leitmotif). Series style: 1-bit dither, no glows or page flips. Respects REDUCE EFFECTS.
- **Open:** which choices count as "first": the intake questionnaire only, or the Prologue too? Should the impact be mechanical (stats), narrative (callbacks) or both?

## 7. Samun: white lies and soft vs harsh truth (item 7)
Design is the main work. Proposal for discussion:
- **Four-way delivery instead of two:** per node, a swipe still picks truth/lie, but a second gesture/tone picks delivery: **Harsh truth, Soft truth, White lie, Harmful lie**. Soft truth and white lie are the new middle options. (Existing `sayTone.js` is the likely hook; check what it already does before adding a new input.)
- **Core rule:** a white lie is a true thing said in a kind way, so it should lower friction without opening Truth Debt much; a harmful lie pays now and costs later. Examples with Samun's node 1: Harsh "you're killing yourself"; Soft "I'm worried about what it's doing to you"; White lie "I get why you need it"; Harmful "At least you know what it is" (current lie).
- **Balance:** white lie costs small debt (e.g. +1) and gives small trust; capped per NPC by a "white lie budget" so stacking them tips into harmful (the irresponsible case). Harmful lie keeps current numbers. Truth keeps stability cost. Tune in STAT_MATH.
- **Goal:** extract the truth from Samun, "one way or another": a Samun-specific "truth meter" (his guard) that every delivery moves by a different amount; reaching it unlocks his secret/the confession. Harsh is fast and risky, soft is steady, white lies are slow but cheap on you, harmful lies stall or backfire.
- **Visual cues of the math:** delivery chips preview effect arrows on the meters (up/down only, no numbers by default, numbers in a tap-to-reveal), like the live color preview on drag. Must remain non-judgmental: show consequence in the lake/scope, not "good/bad".
- **Open (needs your call):**
  1. Samun-only prototype, or build the 4-way delivery for all NPCs (Rwanda deliberately has no lie bids)?
  2. Is the "truth meter" visible, or shown atmospherically (his mask slipping)?
  3. How does the QA bot/balance check ("every class can reach every NPC") cover a 4-way system?
  4. Writer pass: ~4 lines per Samun node (about 2x current Samun content).

## 8. Ending: unique QR + history (item 8)
- Current: ending produces a pixel fax record that saves as an official FEELZ PNG (`ui/feelzRecord.js`).
- Do:
  - Encode a compact run summary (chapter, class, ending, stats, key choices, version, seed/run id) into a QR printed on the record PNG. No server needed: QR carries the data (or a short code + hash).
  - **Digital copy:** "download unique save file" containing the same data (JSON) the QR encodes; importing it restores unlocks/history.
  - **Local history:** every finished run saved locally with its QR; a History screen lists runs and shows each QR; unlocks accumulate and each update's QR can include the history so far.
- Needs a vendored QR encoder (small MIT lib or ~300 lines of our own, vanilla JS).
- **Open:** what must the QR do: just show a code, or open a URL on dreamxtre.me that loads the run (needs a read-only page, still no server)? Should importing a QR/file change game state (unlocks), and does that invite cheating (is that fine)? Privacy: no personal data in the QR.

---

## Cross-cutting
- Every step: calc(N * var(--px)) units, REDUCE EFFECTS, silent browser tests (mute before bot playthroughs), block mp3/mp4 in the test browser (IDM).
- Update `HANDOFF.md` "What's next" per step; manuscript sources for new text so the writer pipeline stays the source of truth.
- Bot playthrough + overflow sweep after steps 4-7 (onboarding and dialog input changes are the highest regression risk).
- Commit directly to main per step; hold pushes until you confirm the URL.

## Still open after your answers
1. Rwanda typo: wording or screenshot? And what is "lie still" (alley minigame or dialog) and what should it earn?
2. OK to download Rwanda's 5 GIFs from Drive into `art-import/rwanda/`?
3. Round mapping above (Deborah=swipe+batteries, Rwanda=wheel/scope, Samun=delivery spectrum, Rick=all): right, or does a mechanic belong elsewhere?
4. QR as a link with data after `#` (above): OK?
