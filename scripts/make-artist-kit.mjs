#!/usr/bin/env node
// Builds the artist delivery kit: deliverables/DreamXtreme_ArtistKit/ with
//   index.html   the guide: every asset, sizes, status, previews, templates
//   templates/   the 12 drawing templates (scripts/make-art-templates.mjs)
//   reference/   what's in the game today (current art + placeholders)
//   ART_GUIDE.md the same guide as plain text
// then zips it to deliverables/DreamXtreme_ArtistKit.zip.
//
// Usage: node scripts/make-artist-kit.mjs   (Windows: zips with PowerShell)
import sharp from 'sharp';
import { mkdirSync, copyFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ICONS } from '../src/ui/feelingIcons.js';
import { ROWS as PASTOR_ROWS, COLORS as PASTOR_COLORS } from '../src/ui/pastorBust.js';

const KIT = 'deliverables/DreamXtreme_ArtistKit';
const ZIP = 'deliverables/DreamXtreme_ArtistKit.zip';
const A = 'public/assets';
rmSync(KIT, { recursive: true, force: true });
for (const d of ['templates', 'reference']) mkdirSync(join(KIT, d), { recursive: true });

// ── Templates ─────────────────────────────────────────────────────────────
if (!existsSync('art-templates')) execFileSync('node', ['scripts/make-art-templates.mjs'], { stdio: 'inherit' });
for (const f of readdirSync('art-templates')) copyFileSync(join('art-templates', f), join(KIT, 'templates', f));
copyFileSync('docs/ART_GUIDE.md', join(KIT, 'ART_GUIDE.md'));

// ── Reference images (what's in the game now) ─────────────────────────────
const ref = (name) => join(KIT, 'reference', name);
const px = (w) => ({ width: w, kernel: 'nearest' });
await sharp(`${A}/shared/title/spr_game_title.png`).extract({ left: 0, top: 0, width: 640, height: 280 }).png().toFile(ref('title_logo_frame.png'));
await sharp(`${A}/shared/title/spr_title_bg.png`).extract({ left: 0, top: 0, width: 500, height: 288 }).png().toFile(ref('title_lake_tile.png'));
await sharp(`${A}/shared/sprites/spr_it_icon.webp`).resize(px(256)).png().toFile(ref('it_icon_x8.png'));
await sharp(`${A}/lake-ulysses/sprites/spr_bb/spr_bb_0000.webp`).png().toFile(ref('bob_baiter_frame.png'));
await sharp(`${A}/lake-ulysses/sprites/spr_lake_bg_001/spr_lake_bg_001_0000.webp`).png().toFile(ref('lake_cutscene_bg.png'));
await sharp(`${A}/lake-ulysses/sprites/spr_QuoteBG/spr_QuoteBG_0000.webp`).png().toFile(ref('quote_bg.png'));
for (const s of ['spr_biohazard', 'spr_fish', 'spr_baitshop', 'spr_exposure', 'spr_pet_symbol']) {
  await sharp(`${A}/lake-ulysses/sprites/${s}/${s}_0000.webp`).png().toFile(ref(`${s.replace('spr_', 'symbol_')}.png`));
}
for (const s of ['npc_rick.svg', 'hallway_diploma.svg', 'hallway_diploma_closeup.svg']) copyFileSync(`${A}/lake-ulysses/sprites/${s}`, ref(`placeholder_${s}`));
copyFileSync(`${A}/lake-ulysses/sprites/spr_hallway_bg/spr_hallway_bg_0000.svg`, ref('placeholder_room_bg.svg'));

// Pixel art that's drawn in code, rendered out so it can be seen and redrawn.
const FEEL_COLOR = { Anger: '#ff3b1f', Fear: '#7b5cff', Anxiety: '#ff9800', Trust: '#00d9c0', Disgust: '#5fd35f', Happy: '#ffe135', Sadness: '#1e90ff', Surprise: '#ff5fd2' };
const ICON_NAME = { Anger: 'flame', Fear: 'wide eye', Sadness: 'raindrop', Happy: 'sun', Anxiety: 'tangled knot', Disgust: 'ugh face', Surprise: 'spark burst', Trust: 'open hand' };
function gridSvg(rows, colorOf, cell) {
  const w = rows[0].length * cell;
  const h = rows.length * cell;
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = colorOf(ch); if (c) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${c}"/>`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${rects}</svg>`;
}
for (const [name, rows] of Object.entries(ICONS)) {
  await sharp(Buffer.from(gridSvg(rows, (ch) => (ch === '#' ? FEEL_COLOR[name] : null), 16))).png().toFile(ref(`feeling_${name.toLowerCase()}.png`));
}
await sharp(Buffer.from(gridSvg(PASTOR_ROWS, (ch) => PASTOR_COLORS[ch] ?? null, 16))).png().toFile(ref('pastor_bust_codeart.png'));

// ── The data the guide renders ────────────────────────────────────────────
// status: final | placeholder | missing | code
const SECTIONS = [
  {
    id: 'title', title: 'Title & menus', blurb: 'The front door: logo, the lake behind it, and each chapter\'s banner on chapter select.',
    assets: [
      { name: 'Title logo', path: 'public/assets/shared/title/spr_game_title.png', draw: '1260×551 per frame', shown: 'canvas width; arrives split (top from the left, bottom from the right), slams, strobes', format: 'Palette PNG sheet, transparent', frames: '13', status: 'final', template: 'title_logo_1280x560.png', preview: 'title_logo_frame.png', notes: 'From the GameMaker beta. 1-bit dither. Keep a clean split line through the middle: the halves slide in separately.' },
      { name: 'Title background (pans forever)', path: 'public/assets/shared/title/spr_title_bg.png', draw: '1073×483 per frame', shown: 'full screen height, panning slowly', format: 'Palette PNG vertical sheet', frames: '7', status: 'final', template: 'panorama_frame_1280x576.png', preview: 'title_lake_tile.png', notes: 'Each frame\'s right 22% dissolves into its left edge at import, so the pan loops with no seam.' },
      { name: 'Chapter banner (one per chapter)', path: 'src/main.js → CHAPTERS[id].banner', draw: '1280×576 per frame', shown: 'card 118px tall; full screen, black and white, on hover', format: 'Palette PNG vertical sheet', frames: 'any (7 is good)', status: 'placeholder', template: 'panorama_frame_1280x576.png', preview: 'title_lake_tile.png', notes: 'Lake Ulysses uses the title lake tinted teal until it has its own. Same panorama rules: keep the right 22% continuous with the left edge.' },
    ],
  },
  {
    id: 'characters', title: 'Characters', blurb: 'Faces and figures. Portraits are used everywhere a character appears small: dialog, calls, the stay-in-touch moment, their story.',
    assets: [
      { name: 'Dialog portrait: Deborah, Rwanda, Samun, Rick', path: 'public/assets/lake-ulysses/sprites/portrait_<name>.webp', draw: '192×192', shown: '96×96 inside a 3px colored border', format: 'WebP, transparent', frames: '1', status: 'missing', template: 'portrait_192.png', notes: 'Today each shows a colored letter. Accent colors: Deborah #ffd700, Rwanda #00ced1, Samun #4169e1, Rick #b22222.' },
      { name: 'Therapist portrait', path: 'public/assets/lake-ulysses/sprites/portrait_therapist.webp', draw: '192×192', shown: '96×96', format: 'WebP', frames: '1', status: 'missing', template: 'portrait_192.png', notes: 'He is voice-only by design (Charles Browning, clinical grey #9aa0a6). Ask before drawing.' },
      { name: 'Confrontation bust ×4', path: 'public/assets/lake-ulysses/sprites/npc_<name>.webp', draw: '600×1200', shown: '72% of screen height, bottom-anchored', format: 'WebP, transparent', frames: '1 (more optional)', status: 'placeholder', template: 'confront_bust_600x1200.png', preview: 'placeholder_npc_rick.svg', notes: 'May bleed off the left and right, never off the bottom.' },
      { name: 'Pastor Gabriel bust', path: 'public/assets/lake-ulysses/sprites/bust_pastor.webp', draw: '480×384', shown: '~120px wide; fades in on the death-clock bells', format: 'WebP or palette PNG', frames: '1', status: 'code', template: 'pastor_bust_480x384.png', preview: 'pastor_bust_codeart.png', notes: 'The angel of death in shirtsleeves: halo, clerical collar, dark wings. The preview is the placeholder pixel art.' },
      { name: 'Bob Baiter (cutscene speaker)', path: 'public/assets/lake-ulysses/sprites/spr_bb/', draw: '600×600', shown: 'bottom-anchored', format: 'WebP', frames: '10', status: 'final', template: 'speaker_sprite_600x600.png', preview: 'bob_baiter_frame.png' },
    ],
  },
  {
    id: 'rooms', title: 'Walk rooms', blurb: 'One room per NPC (hallway, alley, garage, bar lot): a background, three objects you can inspect, their close-ups, and a door. Planned: Deborah\'s garden, Rwanda\'s mural, Samun\'s crosswalk at the same sizes.',
    assets: [
      { name: 'Room background', path: 'public/assets/lake-ulysses/sprites/spr_<room>_bg/spr_<room>_bg_000N.webp', draw: '780×1688 (2× of 390×844)', shown: 'full screen', format: 'WebP', frames: '6', status: 'placeholder', template: 'room_bg_780x1688.png', preview: 'placeholder_room_bg.svg', notes: 'Keep the top strip clear (skip and settings buttons).' },
      { name: 'Room object', path: 'public/assets/lake-ulysses/sprites/<room>_<object>.webp', draw: '2× the manifest size (see ASSET_MANIFEST.md)', shown: 'at its spot in the room', format: 'WebP, transparent', frames: '1', status: 'placeholder', preview: 'placeholder_hallway_diploma.svg' },
      { name: 'Object close-up', path: 'public/assets/lake-ulysses/sprites/<room>_<object>_closeup.webp', draw: '780×1440 (2× of 390×720)', shown: 'full width; a caption covers the bottom quarter', format: 'WebP', frames: '1', status: 'placeholder', template: 'closeup_780x1440.png', preview: 'placeholder_hallway_diploma_closeup.svg' },
    ],
  },
  {
    id: 'cutscenes', title: 'Cutscenes', blurb: 'Full-screen backgrounds and the symbols Bob Baiter announces.',
    assets: [
      { name: 'Lake background (Bob Baiter)', path: 'public/assets/lake-ulysses/sprites/spr_lake_bg_001/', draw: '390×844 (2× welcome)', shown: 'full screen', format: 'WebP', frames: '46', status: 'final', template: 'room_bg_780x1688.png', preview: 'lake_cutscene_bg.png' },
      { name: 'Opening quote background', path: 'public/assets/lake-ulysses/sprites/spr_QuoteBG/', draw: '390×844', shown: 'full screen', format: 'WebP', frames: '5', status: 'final', template: 'room_bg_780x1688.png', preview: 'quote_bg.png' },
      { name: 'Prologue lake', path: 'public/assets/lake-ulysses/backgrounds/prologue-lake.svg', draw: '780×1688', shown: 'full screen', format: 'WebP', frames: '1', status: 'placeholder', template: 'room_bg_780x1688.png' },
      { name: 'Announcement symbols', path: 'public/assets/lake-ulysses/sprites/spr_biohazard/ (and exposure, fish, pet, bait shop)', draw: '384 wide, square-ish', shown: 'centered over Bob\'s head', format: 'WebP', frames: '19–32', status: 'final', template: 'symbol_384x384.png', preview: 'symbol_biohazard.png', gallery: ['symbol_biohazard.png', 'symbol_exposure.png', 'symbol_fish.png', 'symbol_pet_symbol.png', 'symbol_baitshop.png'] },
    ],
  },
  {
    id: 'ending', title: 'Ending', blurb: 'Each line of the ending is its own slide over an image. Today they are labeled placeholder frames.',
    assets: [
      { name: 'Story slide (one per ending line)', path: 'endings.json → images: [...] per ending', draw: '800×600 (4:3)', shown: 'full width, 2px white frame', format: 'WebP', frames: 'Clean Cut 5 · Functional Mask 5 · Collapse 5 · Living Lie 6', status: 'missing', template: 'ending_slide_800x600.png', notes: 'Clean Cut: the truth told and paid for. Functional Mask: the lake reopens under "monitoring". Collapse: sirens, dead fish, nobody in charge. Living Lie: green water, a 4.8-star app.' },
      { name: 'Epilogue slide (optional)', path: 'same list, after the lines', draw: '800×600', shown: 'full width', format: 'WebP', frames: '1 per broken stat (integrity, trust, stability, lucidity)', status: 'missing', template: 'ending_slide_800x600.png' },
    ],
  },
  {
    id: 'code', title: 'Interface art drawn in code', blurb: 'Generated in code as pixel grids. Redraw any of them if you like; keep the exact grid size.',
    assets: [
      { name: 'Feeling icons ×8', path: 'src/ui/feelingIcons.js', draw: '9×9 grid', shown: 'on the wheel slices, the drag bubble, the report', format: 'pixel grid (one color: the feeling\'s)', frames: '1 each', status: 'code', template: 'feeling_icon_9x9_at16x.png', preview: 'feeling_anger.png', gallery: Object.keys(ICONS).map((n) => `feeling_${n.toLowerCase()}.png`), notes: Object.entries(ICON_NAME).map(([k, v]) => `${k}: ${v}`).join(' · ') },
      { name: 'IT / SO icon', path: 'public/assets/shared/sprites/spr_it_icon.webp', draw: '32×32', shown: 'in the IT/SO popups (SO = inverted)', format: 'WebP', frames: '1', status: 'final', template: 'it_icon_32x32_at16x.png', preview: 'it_icon_x8.png' },
      { name: 'Status bar icons (signal, Wi-Fi, battery)', path: 'src/ui/statusBar.js', draw: '11×8 / 15×8 grids', shown: 'top of every dialog screen', format: 'pixel grid', frames: '—', status: 'code' },
      { name: 'Gear & skip buttons', path: 'src/shell/hud.js', draw: '13×13 grids', shown: 'top corners', format: 'pixel grid', frames: '—', status: 'code' },
      { name: 'Fax printer', path: 'src/ui/feelzRecord.js', draw: '46×7 grid', shown: 'the ending record', format: 'pixel grid', frames: '—', status: 'code' },
      { name: 'FEELZ wheel', path: 'src/ui/feelzSilhouette.js', draw: '48×48 grid', shown: 'boot logo, profile reveal', format: 'pixel grid', frames: '—', status: 'code', notes: 'Slice order clockwise from the top: happy, trust, fear, surprise, sadness, disgust, anger, anxiety.' },
    ],
  },
];

const RULES = [
  ['The frame is 390×844', 'A portrait phone screen. It scales to fit every device but keeps that shape. Draw at 2× (780×1688 for full screen) unless an asset says otherwise.'],
  ['Lo-fi pixel / 1-bit dither', 'Black, white, a few accent colors. Hard edges, no soft gradients. The game scales with nearest-neighbor, so crisp pixels stay crisp.'],
  ['Formats', 'Color art: WebP (~70 quality). Pure 1-bit dither: PNG with a tiny palette. Placeholders are SVG; real art replaces them at the same path.'],
  ['Frames', 'Animated art is numbered frames, all the same size: name_0000.webp, name_0001.webp… in a folder named after the sprite. Default 12 fps.'],
  ['Bottom-anchored figures', 'Busts and speakers may bleed off the left and right, never off the bottom.'],
  ['Keep the top strip clear', 'The top 48px (96px at 2×) of full-screen art: the skip and settings buttons live there.'],
  ['Hand over source + export', 'Draw on a layer above the template, hide the template, export. Send the layered file too.'],
];

const PALETTE = [
  ['Anger', '#ff3b1f'], ['Fear', '#7b5cff'], ['Anxiety', '#ff9800'], ['Trust', '#00d9c0'],
  ['Disgust', '#5fd35f'], ['Happy', '#ffe135'], ['Sadness', '#1e90ff'], ['Surprise', '#ff5fd2'],
  ['Therapist', '#9aa0a6'], ['Deborah', '#ffd700'], ['Rwanda', '#00ced1'], ['Samun', '#4169e1'], ['Rick', '#b22222'],
  ['Paper', '#f4f1e8'], ['Ink', '#1d1d22'],
];

const TEMPLATES = readdirSync('art-templates').sort();

// ── index.html ────────────────────────────────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dream Xtreme · Artist Kit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0b0b0e; --panel: #15151b; --panel2: #1d1d25; --line: #2e2e3a; --text: #ecebe6; --dim: #9a99a3;
  --accent: #ffe135; --final: #5fd35f; --placeholder: #ff9800; --missing: #ff5f5f; --code: #7b5cff;
  --pixel: 'Press Start 2P', 'Courier New', monospace; --mono: 'VT323', 'Courier New', monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 20px; line-height: 1.35; }
a { color: var(--accent); }
header.hero { padding: 40px 24px 28px; border-bottom: 2px solid var(--line); background:
  repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 4px), linear-gradient(135deg, #15151b, #0b0b0e); }
.hero h1 { font-family: var(--pixel); font-size: clamp(18px, 3.4vw, 30px); margin: 0 0 14px; letter-spacing: 0.06em; }
.hero h1 .x { color: var(--accent); }
.hero p { margin: 0; color: var(--dim); max-width: 760px; }
.feelz span:nth-child(1){color:#ff3b1f}.feelz span:nth-child(2){color:#ffe135}.feelz span:nth-child(3){color:#00d9c0}.feelz span:nth-child(4){color:#1e90ff}.feelz span:nth-child(5){color:#ff9800}
.layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 18px 14px; border-right: 2px solid var(--line); background: var(--panel); }
nav h2 { font-family: var(--pixel); font-size: 10px; color: var(--dim); letter-spacing: 0.12em; margin: 18px 0 8px; }
nav a { display: block; padding: 6px 8px; color: var(--text); text-decoration: none; border-left: 3px solid transparent; }
nav a:hover { background: var(--panel2); border-left-color: var(--accent); }
.search { width: 100%; padding: 8px 10px; font: inherit; color: var(--text); background: var(--bg); border: 2px solid var(--line); }
.search:focus { outline: none; border-color: var(--accent); }
.legend { display: grid; gap: 4px; margin-top: 8px; font-size: 18px; }
main { padding: 24px; max-width: 1100px; }
section { margin-bottom: 34px; scroll-margin-top: 14px; }
section > h2 { font-family: var(--pixel); font-size: 15px; letter-spacing: 0.06em; margin: 0 0 6px; }
section > .blurb { color: var(--dim); margin: 0 0 14px; }
details.asset { background: var(--panel); border: 2px solid var(--line); margin-bottom: 10px; }
details.asset[open] { border-color: #444456; }
details.asset > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 56px 1fr auto auto; gap: 12px; align-items: center; padding: 10px 12px; }
details.asset > summary::-webkit-details-marker { display: none; }
summary .thumb { width: 56px; height: 44px; background: #000 center/contain no-repeat; image-rendering: pixelated; border: 1px solid var(--line); }
summary .nm { font-size: 22px; }
summary .sz { color: var(--dim); white-space: nowrap; }
summary .chev { font-family: var(--pixel); font-size: 10px; color: var(--dim); transition: transform 0.15s; }
details[open] summary .chev { transform: rotate(90deg); }
.badge { display: inline-block; font-family: var(--pixel); font-size: 8px; padding: 4px 6px; letter-spacing: 0.08em; color: #000; vertical-align: middle; }
.b-final { background: var(--final); } .b-placeholder { background: var(--placeholder); } .b-missing { background: var(--missing); } .b-code { background: var(--code); color: #fff; }
.body { display: grid; grid-template-columns: 1fr 280px; gap: 18px; padding: 4px 14px 16px; border-top: 1px dashed var(--line); }
dl { display: grid; grid-template-columns: 110px 1fr; gap: 4px 12px; margin: 12px 0; }
dt { color: var(--dim); }
dd { margin: 0; }
code.path { font-family: var(--mono); background: #000; padding: 1px 6px; border: 1px solid var(--line); word-break: break-all; }
.copy { font: inherit; font-size: 16px; margin-left: 6px; padding: 0 8px; background: var(--panel2); color: var(--text); border: 1px solid var(--line); cursor: pointer; }
.copy:hover { border-color: var(--accent); }
.notes { color: var(--dim); margin: 6px 0 10px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { display: inline-block; font-family: var(--pixel); font-size: 9px; letter-spacing: 0.06em; padding: 10px 12px; text-decoration: none; color: #000; background: var(--accent); border: 2px solid var(--accent); }
.btn.ghost { background: transparent; color: var(--accent); }
.btn:hover { filter: brightness(1.15); }
.previews { display: grid; gap: 8px; align-content: start; }
.prev { background: #000 repeating-conic-gradient(#14141a 0 25%, #0e0e13 0 50%) 0 0/16px 16px; border: 1px solid var(--line); cursor: zoom-in; display: flex; align-items: center; justify-content: center; min-height: 120px; padding: 6px; }
.prev img { max-width: 100%; max-height: 200px; image-rendering: pixelated; }
.gallery { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.gallery .prev { min-height: 60px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.card { background: var(--panel); border: 2px solid var(--line); padding: 10px; display: grid; gap: 8px; }
.card .prev { min-height: 140px; }
.card .t { font-size: 18px; word-break: break-all; }
.rules { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.rule { background: var(--panel); border-left: 4px solid var(--accent); padding: 10px 12px; }
.rule b { display: block; font-family: var(--pixel); font-size: 10px; letter-spacing: 0.05em; margin-bottom: 6px; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.sw { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--line); padding: 6px; cursor: pointer; }
.sw i { width: 34px; height: 34px; border: 1px solid #000; flex: none; }
.sw small { display: block; color: var(--dim); }
ol.check li { margin: 6px 0; }
.empty { display: none; color: var(--dim); padding: 20px; border: 2px dashed var(--line); text-align: center; }
#lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: none; align-items: center; justify-content: center; flex-direction: column; gap: 10px; z-index: 10; cursor: zoom-out; padding: 20px; }
#lightbox.on { display: flex; }
#lightbox img { max-width: 95vw; max-height: 85vh; image-rendering: pixelated; background: repeating-conic-gradient(#222 0 25%, #181818 0 50%) 0 0/16px 16px; }
#lightbox p { margin: 0; color: var(--dim); }
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--accent); color: #000; padding: 8px 14px; font-family: var(--pixel); font-size: 10px; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.toast.on { opacity: 1; }
.top-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
@media (max-width: 820px) {
  .layout { grid-template-columns: 1fr; }
  nav { position: static; height: auto; border-right: none; border-bottom: 2px solid var(--line); }
  .body { grid-template-columns: 1fr; }
  details.asset > summary { grid-template-columns: 48px 1fr auto; }
  summary .sz { display: none; }
}
</style>
</head>
<body>
<header class="hero">
  <h1>DREAM <span class="x">X</span>TREME · ARTIST KIT</h1>
  <p>Everything the game needs drawn: sizes, how each piece is shown, what exists today, and a template for each. Truth Debt: Lake Ulysses, chapter 1. Built ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
  <div class="top-actions">
    <a class="btn" href="#rules">Start here: the rules</a>
    <a class="btn ghost" href="#templates">All templates</a>
    <a class="btn ghost" href="ART_GUIDE.md" download>ART_GUIDE.md</a>
  </div>
</header>
<div class="layout">
  <nav>
    <input class="search" id="search" type="search" placeholder="Search assets…" aria-label="Search assets">
    <h2>GUIDE</h2>
    <a href="#rules">The rules</a>
    ${SECTIONS.map((s) => `<a href="#${s.id}">${s.title}</a>`).join('\n    ')}
    <a href="#templates">Templates</a>
    <a href="#palette">Color palette</a>
    <a href="#handover">Handing art over</a>
    <h2>STATUS</h2>
    <div class="legend">
      <span><span class="badge b-final">FINAL</span> in the game</span>
      <span><span class="badge b-placeholder">PLACEHOLDER</span> replace it</span>
      <span><span class="badge b-missing">NEEDED</span> nothing yet</span>
      <span><span class="badge b-code">CODE ART</span> optional</span>
    </div>
  </nav>
  <main>
    <section id="rules">
      <h2>THE RULES</h2>
      <p class="blurb">Seven things to know before drawing anything.</p>
      <div class="rules">${RULES.map(([t, d]) => `<div class="rule"><b>${t}</b>${d}</div>`).join('')}</div>
    </section>
    ${SECTIONS.map((s) => `
    <section id="${s.id}" class="asset-section">
      <h2>${s.title.toUpperCase()}</h2>
      <p class="blurb">${s.blurb}</p>
      ${s.assets.map((a) => {
        const thumb = a.preview ? `reference/${a.preview}` : a.template ? `templates/${a.template}` : '';
        const label = { final: 'FINAL', placeholder: 'PLACEHOLDER', missing: 'NEEDED', code: 'CODE ART' }[a.status];
        const prevs = a.gallery
          ? `<div class="gallery">${a.gallery.map((g) => `<div class="prev" data-src="reference/${g}" data-cap="${g}"><img src="reference/${g}" alt=""></div>`).join('')}</div>`
          : a.preview ? `<div class="prev" data-src="reference/${a.preview}" data-cap="Current: ${a.preview}"><img src="reference/${a.preview}" alt=""></div>` : '';
        const tprev = a.template ? `<div class="prev" data-src="templates/${a.template}" data-cap="Template: ${a.template}"><img src="templates/${a.template}" alt=""></div>` : '';
        return `
      <details class="asset" data-search="${[s.title, a.name, a.path, a.draw, a.status, a.notes ?? ''].join(' ').toLowerCase().replace(/"/g, '')}">
        <summary>
          <span class="thumb" style="background-image:url('${thumb}')"></span>
          <span class="nm">${a.name} <span class="badge b-${a.status}">${label}</span></span>
          <span class="sz">${a.draw}</span>
          <span class="chev">▶</span>
        </summary>
        <div class="body">
          <div>
            <dl>
              <dt>Draw at</dt><dd>${a.draw}</dd>
              <dt>Shown</dt><dd>${a.shown}</dd>
              <dt>Format</dt><dd>${a.format}</dd>
              <dt>Frames</dt><dd>${a.frames}</dd>
              <dt>File</dt><dd><code class="path">${a.path}</code><button class="copy" data-copy="${a.path}">copy</button></dd>
            </dl>
            ${a.notes ? `<p class="notes">${a.notes}</p>` : ''}
            <div class="actions">
              ${a.template ? `<a class="btn" href="templates/${a.template}" download>Download template</a>` : ''}
              ${a.preview ? `<a class="btn ghost" href="reference/${a.preview}" download>Download current</a>` : ''}
            </div>
          </div>
          <div class="previews">${prevs}${tprev}</div>
        </div>
      </details>`;
      }).join('')}
    </section>`).join('')}
    <div class="empty" id="empty">No assets match that search.</div>
    <section id="templates">
      <h2>TEMPLATES</h2>
      <p class="blurb">Transparent PNGs with guide lines. Pink = edges and no-go lines · blue = safe areas · yellow = notes. Draw on a layer above, hide the template, export.</p>
      <div class="cards">${TEMPLATES.map((t) => `
        <div class="card">
          <div class="prev" data-src="templates/${t}" data-cap="${t}"><img src="templates/${t}" alt=""></div>
          <span class="t">${t}</span>
          <a class="btn" href="templates/${t}" download>Download</a>
        </div>`).join('')}
      </div>
    </section>
    <section id="palette">
      <h2>COLOR PALETTE</h2>
      <p class="blurb">The eight feelings, the characters' accents, and the fax paper. Click a swatch to copy its hex.</p>
      <div class="swatches">${PALETTE.map(([n, h]) => `<div class="sw" data-copy="${h}"><i style="background:${h}"></i><span>${n}<small>${h}</small></span></div>`).join('')}</div>
    </section>
    <section id="handover">
      <h2>HANDING ART OVER</h2>
      <ol class="check">
        <li>Export at the size in the asset's <b>Draw at</b>, named exactly as its <b>File</b> path.</li>
        <li>Animated art: every frame the same size, numbered from <code class="path">_0000</code>.</li>
        <li>Send the export and the layered source file.</li>
        <li>Say the frame rate for anything animated (default 12 fps).</li>
        <li>Panoramas: keep the right 22% continuous with the left edge.</li>
      </ol>
    </section>
  </main>
</div>
<div id="lightbox" role="dialog" aria-label="Preview"><img alt=""><p></p></div>
<div class="toast" id="toast">COPIED</div>
<script>
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Search: filter asset rows, open matches, hide empty sections.
$('#search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  let any = false;
  for (const sec of $$('.asset-section')) {
    let shown = 0;
    for (const d of $$('details.asset', sec)) {
      const hit = !q || d.dataset.search.includes(q);
      d.style.display = hit ? '' : 'none';
      d.open = !!q && hit;
      if (hit) shown++;
    }
    sec.style.display = shown ? '' : 'none';
    if (shown) any = true;
  }
  $('#empty').style.display = any ? 'none' : 'block';
});
// Lightbox for any preview.
const lb = $('#lightbox');
document.addEventListener('click', (e) => {
  const p = e.target.closest('.prev');
  if (p) { $('img', lb).src = p.dataset.src; $('p', lb).textContent = p.dataset.cap || ''; lb.classList.add('on'); return; }
  if (e.target.closest('#lightbox')) lb.classList.remove('on');
  const c = e.target.closest('[data-copy]');
  if (c) {
    navigator.clipboard?.writeText(c.dataset.copy).catch(() => {});
    const t = $('#toast'); t.textContent = 'COPIED ' + c.dataset.copy; t.classList.add('on');
    setTimeout(() => t.classList.remove('on'), 1200);
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('on'); });
</script>
</body>
</html>
`;
writeFileSync(join(KIT, 'index.html'), html);

// ── Zip ───────────────────────────────────────────────────────────────────
rmSync(ZIP, { force: true });
if (process.platform === 'win32') {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${KIT}' -DestinationPath '${ZIP}' -Force`], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-rq', ZIP, KIT], { stdio: 'inherit' });
}
console.log(`kit: ${KIT}\nzip: ${ZIP}`);
