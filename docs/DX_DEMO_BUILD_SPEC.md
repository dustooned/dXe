**DREAM XTREME**

DX — DEMO PROTOTYPE BUILD SPEC

v0.1 — FOR USE WITH CODEX / AI-ASSISTED BUILD

*Lake Ulysses. The water looks fine.*

# **1\. DEMO OVERVIEW**

This document is the complete build specification for the Dream Xtreme (DX) demo prototype. It is written for use with AI-assisted coding tools (Codex, Claude, Cursor, etc.) and covers architecture, assets, dialog, and data structures.

The demo proves the core loop only. Full branching, NPCMemory, Masks, and New Game+ are v2 scope.

## **1.1 Demo Scope**

| ELEMENT | DEMO (v0.1) | FULL GAME (v2+) |
| :---- | :---- | :---- |
| Characters | 1 (GUNS) | 3 (GUNS, BIBLE, CRYSTAL) |
| NPC Encounters | 3 (Deborah, Rwanda, Samun) | 5 (+ Rick, extras) |
| Nodes per NPC | 2 (opening \+ 1 branch) | 4–6 per NPC |
| Endings | 2 (Clean Cut / Living Lie) | 8 base \+ NPC flavor |
| Reckoning Cards | 3 (from ledger) | Dynamic from full ledger |
| Branching Logic | Linear \+ debt threshold | Full graph \+ NPCMemory |
| Masks System | None | Unlockable post-run |
| New Game+ | None | Inherited emotional bias |

## **1.2 Visual Direction**

1-bit monochrome base layer with indexed color accents. Inspired by classic Mac System 6/7 aesthetic. Color is semantic — never decorative.

| COLOR | HEX | SEMANTIC USE |
| :---- | :---- | :---- |
| Black | \#000000 | Base UI, text, 1-bit sprites |
| White | \#FFFFFF | Background, negative space |
| Algae Green | \#39FF14 | Lake corruption, Debt sigil, bloom events |
| Debt Red | \#FF2222 | Reckoning cards, Integrity loss flash |
| Deborah Yellow | \#FFD700 | Deborah portrait accent, Faith tag |
| Rwanda Teal | \#00CED1 | Rwanda portrait accent, Identity tag |
| Samun Blue | \#4169E1 | Samun portrait accent, Addiction tag |
| FEELZ Anger | \#FF4500 | Anger emotion bubble |
| FEELZ Fear | \#FFD700 | Fear emotion bubble |
| FEELZ Anticipation | \#00BFFF | Anticipation emotion bubble |

# **2\. TECH STACK**

## **2.1 Core Libraries**

| React 18 | UI shell, component tree, routing between screens |
| :---- | :---- |
| **Zustand** | Game state store — TruthDebt, ledger, meters, currentNode |
| **Framer Motion** | Swipe card drag physics, FEELZ wheel pop animation, meter flickers |
| **PixiJS 7** | Lake canvas scene, 1-bit sprite rendering, algae shader |
| **Howler.js** | Synth audio, note bend on lie-swipe, glitch SFX on bloom |
| **Vite** | Build tool, dev server, fast HMR for iteration |

## **2.2 Project Structure**

dx-demo/

  src/

    store/

      gameStore.js          ← Zustand state \+ actions

    engine/

      cardEngine.js         ← resolveCard(), applySwipe()

      emotionEngine.js      ← FEELZ zone mapping, dart logic

      debtEngine.js         ← threshold checks, bloom triggers

      endingEngine.js       ← ending selection from debt score

    content/

      cards/

        deborah.json        ← Deborah dialog nodes

        rwanda.json         ← Rwanda dialog nodes

        samun.json          ← Samun dialog nodes

      reckoning.js          ← builds deck from ledger

      endings.json          ← ending flavor text

    components/

      SwipeCard.jsx         ← draggable card with snap

      FeelzWheel.jsx        ← SVG emotion selector

      MeterBar.jsx          ← flickering icon meters

      LakeCanvas.jsx        ← PixiJS scene wrapper

      NPCPortrait.jsx       ← 1-bit portrait \+ color accent

      DebtSigil.jsx         ← pulsing glyph, glitch on threshold

      ReckoningScreen.jsx   ← final card sequence

      EndingScreen.jsx      ← ending text \+ stats

    screens/

      TitleScreen.jsx

      CharacterSelect.jsx

      GameScreen.jsx        ← main loop container

      ReckoningScreen.jsx

      EndingScreen.jsx

    assets/

      sprites/              ← 1-bit PNG spritesheets

      audio/                ← synth stems \+ SFX

      fonts/                ← bitmap font

  public/

  index.html

  vite.config.js

# **3\. GAME STATE (ZUSTAND STORE)**

All game logic reads from and writes to a single Zustand store. No prop drilling. PixiJS scene subscribes to lakeHealth directly.

## **3.1 State Shape**

GameState \= {

  // Run state (resets each playthrough)

  currentNodeId:   string,        // e.g. 'deborah\_01'

  currentLocation: 1 | 2 | 3 | 4 | 5,

  activeEmotion:   EmotionKey | null,

  truthDebt:       number,        // 0–10

  integrity:       number,        // 0–10

  stability:       number,        // 0–10

  lucidity:        number,        // 0–10

  trust:           number,        // 0–10

  ledger:          LedgerEntry\[\], // logged lies

  sceneEmotion:    { control, connection, comfort },

  lakeHealth:      number,        // 1.0 clean → 0.0 toxic

  bloomsFired:     string\[\],      // triggered threshold IDs

  phase: 'TITLE' | 'SELECT' | 'GAME' | 'RECKONING' | 'ENDING',

}

LedgerEntry \= {

  nodeId:      string,

  npc:         string,

  location:    number,

  ledgerText:  string,   // 'You told Deborah God took her son.'

  debtDelta:   number,

  tags:        string\[\], // \['Faith', 'Health'\]

}

## **3.2 Key Derived Values**

| lakeHealth | 1.0 \- (truthDebt / 10\) — drives PixiJS algae lerp directly |
| :---- | :---- |
| **reckoningDeck** | Built dynamically from ledger at Reckoning phase |
| **endingKey** | Determined by truthDebt threshold at game end |

# **4\. CARD & DIALOG ENGINE**

## **4.1 Card Data Structure**

// content/cards/deborah.json

{

  'id': 'deborah\_01',

  'npc': 'DEBORAH',

  'location': 2,

  'prompt': 'God took my boy when He needed him. I just have to trust that.',

  'feelzOptions': \['Trust', 'Anticipation', 'Fear'\],

  'swipes': {

    'truth': {

      'playerText': 'Your faith did not protect him. Someone failed him.',

      'npcReaction': 'She flinches. Her bible shifts in her grip.',

      'effects': { integrity: \+2, lucidity: \+1, stability: \-2, trust: \-1 },

      'debtDelta': 0,

      'tags': \[\],

      'ledgerEntry': null,

      'nextNodeId': 'deborah\_02\_confronted'

    },

    'lie': {

      'playerText': 'God has a plan. He is at peace.',

      'npcReaction': 'Her smile widens. Too wide.',

      'effects': { integrity: \-2, stability: \+2, trust: \+1 },

      'debtDelta': 4,

      'tags': \['Faith', 'Health'\],

      'ledgerEntry': 'You told Deborah God took her son on purpose.',

      'nextNodeId': 'deborah\_02\_denial'

    }

  }

}

## **4.2 Card Resolution Logic**

function resolveCard(node, swipe, emotion) {

  const edge \= node.swipes\[swipe\]

  // Apply stat effects

  applyStatDelta(edge.effects)

  // Apply debt

  applyDebt(edge.debtDelta)

  // Log lie to ledger

  if (edge.ledgerEntry) {

    addToLedger({

      nodeId: node.id,

      npc: node.npc,

      location: node.location,

      ledgerText: edge.ledgerEntry,

      debtDelta: edge.debtDelta,

      tags: edge.tags

    })

  }

  // Check bloom thresholds

  checkBloomTriggers()

  // Advance to next node

  return edge.nextNodeId

}

# **5\. DEMO DIALOG — ALL 40 LINES**

This is the complete dialog for the demo. Each NPC has 2 nodes × 2 swipes \= 4 player lines \+ 4 NPC reaction lines. Edit tone freely — do not change node IDs.

## **5.1 Deborah — Location 2: Condo / Prayer Closet**

Core truth: 'I want to believe God took my son so I don't have to blame myself.'

### **Node: deborah\_01 (Opening)**

| NPC PROMPT | "God took my boy when He needed him. I just have to trust that." |
| :---- | :---- |
| **TRUTH swipe** | "Your faith didn't protect him. Someone failed him." |
| **TRUTH reaction** | She flinches. Her bible shifts in her grip. |
| **LIE swipe** | "God has a plan. He's at peace." |
| **LIE reaction** | Her smile widens. Too wide. The wallpaper flickers green. |
| **Ledger (lie)** | You told Deborah God took her son on purpose. |

### **Node: deborah\_02\_denial (After lie)**

| NPC PROMPT | "I knew you'd understand. Most people don't want to hear it." |
| :---- | :---- |
| **TRUTH swipe** | "I lied to you. Your grief deserves better than that." |
| **TRUTH reaction** | Her composure breaks. Something underneath it exhales. |
| **LIE swipe** | "You're one of the few who still has real faith." |
| **LIE reaction** | She straightens. She will never question this again. |
| **Ledger (lie)** | You told Deborah she was spiritually superior for blaming God. |

### **Node: deborah\_02\_confronted (After truth)**

| NPC PROMPT | "You don't know what it's like to lose a child." |
| :---- | :---- |
| **TRUTH swipe** | "No. But you do. And you're still here." |
| **TRUTH reaction** | Silence. Then: she nods. Barely. It costs her something. |
| **LIE swipe** | "You're right. I shouldn't have said that." |
| **LIE reaction** | Relief washes over her face. The crack seals back up. |
| **Ledger (lie)** | You apologized for telling Deborah the truth. |

## **5.2 Rwanda — Location 3: Massage Parlor / Takeout Window**

Core truth: 'Why do I have to sand myself down to be digestible?'

### **Node: rwanda\_01 (Opening)**

| NPC PROMPT | "Why do I gotta sand myself down just to be digestible?" |
| :---- | :---- |
| **TRUTH swipe** | "Because people are scared of you being fully real." |
| **TRUTH reaction** | Rwanda exhales. Not relief — recognition. "Yeah. That's what I thought." |
| **LIE swipe** | "It's not that bad here. You're doing fine." |
| **LIE reaction** | She goes quiet. She's heard this before. She expected it from you too. |
| **Ledger (lie)** | You told Rwanda her experience wasn't that bad. |

### **Node: rwanda\_02\_closed (After lie)**

| NPC PROMPT | "Right. Sure. I'm doing fine." (She turns back to the window.) |
| :---- | :---- |
| **TRUTH swipe** | "I was wrong. You don't have to minimize this for me." |
| **TRUTH reaction** | She half-turns. Guarded. "That's a start." |
| **LIE swipe** | "Everyone goes through it. It gets easier." |
| **LIE reaction** | She doesn't answer. The neon buzzes. You've lost her. |
| **Ledger (lie)** | You told Rwanda her erasure was a universal experience. |

### **Node: rwanda\_02\_open (After truth)**

| NPC PROMPT | "You actually mean that? Most people just want me to perform." |
| :---- | :---- |
| **TRUTH swipe** | "I know. And it's exhausting to watch, let alone live." |
| **TRUTH reaction** | She laughs — short, sharp. Real. "Okay. You're alright." |
| **LIE swipe** | "People just need time to get used to you." |
| **LIE reaction** | Her expression flattens. "And there it is." She looks away. |
| **Ledger (lie)** | You told Rwanda to wait for the world to catch up to her. |

## **5.3 Samun — Location 4: Gas Station**

Core truth: 'He just wants the pain to go away.'

### **Node: samun\_01 (Opening)**

| NPC PROMPT | "Man, everyone's hooked on something. Mine's just more honest." |
| :---- | :---- |
| **TRUTH swipe** | "Honest or not, you're still killing yourself slowly." |
| **TRUTH reaction** | He stops wiping his hands. Looks at you. Really looks. |
| **LIE swipe** | "Yeah. Could be worse. At least you know what it is." |
| **LIE reaction** | He grins. Relieved. You just gave him permission for another month. |
| **Ledger (lie)** | You cosigned Samun's denial about his addiction. |

### **Node: samun\_02\_enabled (After lie)**

| NPC PROMPT | "See? You get it. Nobody else does. They all want me fixed." |
| :---- | :---- |
| **TRUTH swipe** | "Maybe fixed is the wrong word. But not this — not this either." |
| **TRUTH reaction** | He gets quiet. Picks at the label on a bottle. Doesn't answer. |
| **LIE swipe** | "They don't understand. You're holding it together fine." |
| **LIE reaction** | He nods hard, like he needed someone to say it. You said it. |
| **Ledger (lie)** | You told Samun that people wanting him to get better were wrong. |

### **Node: samun\_02\_confronted (After truth)**

| NPC PROMPT | "Easy for you to say. You're not the one hurting." |
| :---- | :---- |
| **TRUTH swipe** | "You're right. I'm not. But you are. Every day." |
| **TRUTH reaction** | He turns away. But he doesn't argue. That's something. |
| **LIE swipe** | "Sorry. Forget I said anything. It's your call." |
| **LIE reaction** | "Yeah. It is." He turns back to the counter. Conversation over. |
| **Ledger (lie)** | You walked back the truth with Samun to avoid discomfort. |

## **5.4 Endings**

### **CLEAN CUT — Debt 0–3**

The lake is closed again.

Downtown is half-boarded, but the water is finally clearing.

You told the truth and paid in full.

Nobody thanked you for it.

That's usually how it goes.

### **LIVING LIE — Debt 7–10**

The lake reopens under enhanced monitoring.

Influencers pose near green water.

Dead fish are edited out of the photos.

The app has a 4.8 rating.

Your personal life is stable. Your integrity bar is dust.

The lake looks beautiful today.

# **6\. TRUTH DEBT & BLOOM EVENTS**

## **6.1 Debt Thresholds (Demo)**

| DEBT | EVENT | VISUAL |
| :---- | :---- | :---- |
| 3 | First bloom | Lake water turns slightly murky. First dead fish sprite. |
| 6 | NPC echo | Deborah's voice loops faintly in background audio. |
| 8 | Bloom alert | LAKE WATCH banner flashes. Water turns neon green. |
| 10 | Reckoning | Screen fractures. City Hall sequence begins regardless of location. |

## **6.2 Lake Health Formula**

lakeHealth \= 1.0 \- (truthDebt / 10\)

// PixiJS shader reads lakeHealth directly:

// 1.0 \= clear blue water

// 0.5 \= murky, first algae tint

// 0.2 \= neon green, dead fish sprites active

// 0.0 \= fully toxic, bloom overlay, danger siren audio

# **7\. ASSET SPECIFICATIONS**

All sprites are 1-bit (black and white only) at 2x pixel scale unless noted. Color accents are applied as separate overlay layers — not baked into sprites.

## **7.1 Sprites**

| ASSET | DIMENSIONS | NOTES |
| :---- | :---- | :---- |
| NPC Portrait — Deborah | 128 × 128 px | 1-bit. Yellow (\#FFD700) accent overlay on hair/bible. |
| NPC Portrait — Rwanda | 128 × 128 px | 1-bit. Teal (\#00CED1) accent on sequined top. |
| NPC Portrait — Samun | 128 × 128 px | 1-bit. Blue (\#4169E1) accent on hoodie. |
| Player / GUNS idle | 64 × 64 px | 1-bit. No color accent. |
| Lake scene — clean | 390 × 280 px | 1-bit background. Blue water fill separate layer. |
| Lake scene — murky | 390 × 280 px | Same base. Green tint layer at 40% opacity. |
| Lake scene — toxic | 390 × 280 px | Same base. Green fill layer \+ dead fish sprites active. |
| Dead fish sprite | 16 × 8 px | 1-bit. Placed procedurally as debt rises. |
| FEELZ bubble — Anger | 32 × 32 px | Circle. Fill: \#FF4500. 1-bit label inside. |
| FEELZ bubble — Fear | 32 × 32 px | Circle. Fill: \#FFD700. 1-bit label inside. |
| FEELZ bubble — Anticipation | 32 × 32 px | Circle. Fill: \#00BFFF. 1-bit label inside. |
| Truth Debt sigil | 48 × 48 px | 1-bit glyph. Red (\#FF2222) glow shader as debt rises. |
| Swipe card frame | 320 × 180 px | 1-bit border. White fill. Text rendered in bitmap font. |
| LAKE WATCH banner | 320 × 40 px | 1-bit. Green (\#39FF14) fill. Black text. |
| City Hall — Reckoning BG | 390 × 280 px | 1-bit. Dithered interior scene. |
| Ending BG — Clean Cut | 390 × 280 px | 1-bit. Clear lake. Half-boarded storefronts. |
| Ending BG — Living Lie | 390 × 280 px | 1-bit. Same lake with green overlay. Influencer sprite. |

## **7.2 UI Components**

| COMPONENT | DIMENSIONS | NOTES |
| :---- | :---- | :---- |
| Screen — portrait canvas | 390 × 844 px | iPhone 14 baseline. All layouts target this. |
| Top meter bar area | 390 × 48 px | 4 meters: Integrity, Trust, Stability, Lucidity. |
| Single meter icon | 20 × 20 px | Smartphone-style 1-bit icon. Flickers on loss. |
| Meter bar fill | 60 × 6 px | 1-bit dashed fill. Width \= value/10. |
| Scene viewport | 390 × 280 px | PixiJS canvas. Lake BG \+ NPC portrait. |
| NPC name plate | 200 × 24 px | 1-bit. Bitmap font. Left-aligned. |
| Dialog text box | 350 × 80 px | 1-bit border. Bitmap font 8px. Bottom of scene. |
| FEELZ wheel | 240 × 240 px | SVG. 3 segments for demo. Pops from bottom. |
| Swipe card | 320 × 180 px | Draggable. Centered in lower half. |
| Swipe arrow hints | 24 × 24 px | Left/right arrows. Fade in as player drags. |
| Debt sigil | 48 × 48 px | Fixed bottom-right corner. Pulses with debt level. |

## **7.3 Audio**

| ASSET | FORMAT | NOTES |
| :---- | :---- | :---- |
| Ambient synth loop | MP3 / OGG | Low drone. 60–90 BPM. Loops seamlessly. |
| Truth swipe SFX | MP3 / OGG | Short clear tone. C major. \~0.3s. |
| Lie swipe SFX | MP3 / OGG | Note bends flat. Slight distortion. \~0.4s. |
| Bloom event SFX | MP3 / OGG | Low frequency hit \+ distortion burst. \~0.8s. |
| Debt sigil pulse | MP3 / OGG | Sub-bass click. Syncs to sigil animation. |
| Reckoning sting | MP3 / OGG | Dramatic 3-note descending tone. \~1.5s. |
| Ending — Clean Cut | MP3 / OGG | Sparse, resolving piano or synth. \~8s. |
| Ending — Living Lie | MP3 / OGG | Upbeat but hollow. Major key unease. \~8s. |

## **7.4 Typography**

| Primary font | Press Start 2P (Google Fonts) — all UI text, dialog, meters |
| :---- | :---- |
| **Fallback** | Courier New — acceptable for dev builds |
| **Base size** | 8px (bitmap scale) — rendered at 2x \= 16px display |
| **NPC name** | 10px / bold / character accent color |
| **Dialog text** | 8px / white on black box or black on white card |
| **Meter labels** | 6px / 1-bit icon only in demo — no label text |
| **Ending text** | 10px / centered / line-height 2 |

# **8\. SCREEN FLOW**

TitleScreen

  → \[TAP\] →

CharacterSelect (GUNS only in demo)

  → \[SELECT\] →

GameScreen — Location 2: Deborah

  → \[FEELZ select\] → \[SWIPE\] → \[next node or next NPC\]

GameScreen — Location 3: Rwanda

  → \[FEELZ select\] → \[SWIPE\] → \[next node or next NPC\]

GameScreen — Location 4: Samun

  → \[FEELZ select\] → \[SWIPE\] →

  IF debt \>= 10 → Reckoning (forced)

  ELSE → Reckoning (normal trigger)

ReckoningScreen

  → \[3 ledger cards, confess or double down each\] →

EndingScreen

  IF debt 0–3 → CLEAN CUT

  IF debt 4–6 → FUNCTIONAL MASK (placeholder text in demo)

  IF debt 7–10 → LIVING LIE

## **8.1 GameScreen Layout (Portrait)**

┌─────────────────────────────┐  y=0

│  \[INT\] \[TRU\] \[STB\] \[LUC\]   │  meters: 48px

├─────────────────────────────┤  y=48

│                             │

│   LAKE SCENE (PixiJS)       │  scene: 280px

│   NPC portrait \+ BG         │

│                             │

├─────────────────────────────┤  y=328

│  NPC NAME                   │  nameplate: 24px

│  'Dialog prompt text...'    │  dialog: 80px

├─────────────────────────────┤  y=432

│                             │

│    \[SWIPE CARD\]             │  card: 180px

│    drag left / right        │

│                             │

├─────────────────────────────┤  y=612

│  \[FEELZ WHEEL TAP TARGET\]   │  feelz: 120px

│                             │

│              \[DEBT SIGIL\]   │

└─────────────────────────────┘  y=844

# **9\. NOTES FOR AI-ASSISTED BUILD**

When feeding this document to Codex, Claude, or Cursor, use the following prompt structure:

CONTEXT: You are building Dream Xtreme (DX), a mobile web game.

SPEC DOC: \[this document\]

TASK: \[specific component or file to build\]

CONSTRAINTS:

  \- React 18 \+ Zustand \+ Framer Motion \+ PixiJS 7

  \- All game content lives in JSON files under src/content/

  \- Game state lives exclusively in gameStore.js

  \- No prop drilling — components read from store directly

  \- 1-bit visual style — black/white sprites, color as overlay only

  \- Mobile portrait (390×844) — no landscape support needed

## **9.1 Build Order (Recommended)**

1. gameStore.js — full state shape \+ all actions

2. cardEngine.js — resolveCard(), applySwipe(), applyStatDelta()

3. deborah.json \+ rwanda.json \+ samun.json — all dialog nodes

4. SwipeCard.jsx — Framer Motion drag with left/right snap

5. FeelzWheel.jsx — SVG wheel, 3 segments, tap to select

6. LakeCanvas.jsx — PixiJS scene, lakeHealth lerp, algae shader

7. GameScreen.jsx — wires all components into main loop

8. ReckoningScreen.jsx — builds deck from ledger, runs sequence

9. EndingScreen.jsx — debt threshold → ending selection \+ display

10. Audio integration via Howler.js — last, after visuals confirmed

DREAM XTREME — DX DEMO BUILD SPEC v0.1

*"The lake looks beautiful today."*