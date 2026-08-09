#!/usr/bin/env node
// Generates placeholder SVG art for a mini-game room so the walk system can be
// built and played before any real art exists. Matches the convention already
// set by backgrounds/prologue-lake.svg: 390x844 viewBox, dark palette, and an
// explicit PLACEHOLDER label so nobody mistakes it for finished work.
//
// Emits, per room:
//   spr_<room>_bg/spr_<room>_bg_000N.svg   looping bg frames (jittered)
//   <room>_<object>.svg                    one sprite per interactive object
//   <room>_<object>_closeup.svg            its close-up
//
// Frames are jittered rather than tweened on purpose — the room bg is meant to
// read as stop-motion (hard cuts, low frame count), not smooth animation.
//
// Usage: node scripts/make-placeholder-room.mjs
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets', 'lake-ulysses', 'sprites');

const W = 390, H = 844;
const BG = '#0d0d10', INK = '#1e1e26', LINE = '#2a2a34', LABEL = '#3a3a46';

// Deterministic PRNG so regenerating produces identical files (no git churn).
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">\n${body}\n</svg>\n`;

function bgFrame(i) {
  const r = rng(i * 7919 + 13);
  const j = () => (r() - 0.5) * 3; // per-frame jitter, a few px
  const grain = Array.from({ length: 40 }, () => {
    const x = (r() * W) | 0, y = (r() * H) | 0;
    return `<rect x="${x}" y="${y}" width="2" height="2" fill="${LINE}" opacity="0.5"/>`;
  }).join('\n  ');

  return svg(`  <rect width="${W}" height="${H}" fill="${BG}"/>
  <!-- corridor walls, jittered per frame for the stop-motion read -->
  <path d="M0,${120 + j()} L${W},${150 + j()} L${W},${700 + j()} L0,${740 + j()} Z" fill="${INK}"/>
  <path d="M${60 + j()},${170 + j()} L${330 + j()},${195 + j()} L${330 + j()},${660 + j()} L${60 + j()},${700 + j()} Z" fill="${BG}"/>
  <line x1="0" y1="${740 + j()}" x2="${W}" y2="${700 + j()}" stroke="${LINE}" stroke-width="2"/>
  <line x1="0" y1="${120 + j()}" x2="${W}" y2="${150 + j()}" stroke="${LINE}" stroke-width="2"/>
  ${grain}
  <text x="${W / 2}" y="${H - 40}" text-anchor="middle" font-family="monospace" font-size="11" fill="${LABEL}" letter-spacing="2">PLACEHOLDER ROOM BG</text>
  <text x="${W / 2}" y="${H - 24}" text-anchor="middle" font-family="monospace" font-size="9" fill="${LABEL}" letter-spacing="1">frame ${i}</text>`);
}

// Objects are their own files, deliberately NOT painted into the bg — the tap
// feedback scales them, which is impossible if they're baked into a flat frame.
// See docs/ASSET_GUIDELINES.md "Mini-game rooms".
function objectSprite(label, w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="#15151b" stroke="#4a4a58" stroke-width="2"/>
  <line x1="1" y1="1" x2="${w - 1}" y2="${h - 1}" stroke="#2a2a34" stroke-width="1"/>
  <line x1="${w - 1}" y1="1" x2="1" y2="${h - 1}" stroke="#2a2a34" stroke-width="1"/>
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="9" fill="#6a6a7a">${label}</text>
</svg>\n`;
}

function closeup(label) {
  return svg(`  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="45" y="220" width="300" height="300" fill="#15151b" stroke="#4a4a58" stroke-width="2"/>
  <line x1="45" y1="220" x2="345" y2="520" stroke="#2a2a34" stroke-width="1"/>
  <line x1="345" y1="220" x2="45" y2="520" stroke="#2a2a34" stroke-width="1"/>
  <text x="${W / 2}" y="370" text-anchor="middle" font-family="monospace" font-size="13" fill="#6a6a7a" letter-spacing="1">${label}</text>
  <text x="${W / 2}" y="560" text-anchor="middle" font-family="monospace" font-size="10" fill="${LABEL}" letter-spacing="2">PLACEHOLDER CLOSE-UP</text>`);
}

// Room definition. Coordinates are design-space px against the 390x844 frame,
// exactly the format real art will be handed over in.
const ROOM = {
  id: 'hallway',
  bgFrames: 6,
  objects: [
    { key: 'diploma',  label: 'DIPLOMA',  x: 78,  y: 250, w: 74,  h: 96  },
    { key: 'doormat',  label: 'DOORMAT',  x: 150, y: 596, w: 108, h: 44  },
    { key: 'lightbulb', label: 'BULB',    x: 262, y: 214, w: 52,  h: 62  },
    { key: 'door',     label: 'DOOR',     x: 148, y: 300, w: 100, h: 280 },
  ],
};

function build() {
  const bgDir = join(OUT, `spr_${ROOM.id}_bg`);
  mkdirSync(bgDir, { recursive: true });
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  for (let i = 0; i < ROOM.bgFrames; i++) {
    const name = `spr_${ROOM.id}_bg_${String(i).padStart(4, '0')}.svg`;
    writeFileSync(join(bgDir, name), bgFrame(i), 'utf8');
  }

  for (const o of ROOM.objects) {
    writeFileSync(join(OUT, `${ROOM.id}_${o.key}.svg`), objectSprite(o.label, o.w, o.h), 'utf8');
    writeFileSync(join(OUT, `${ROOM.id}_${o.key}_closeup.svg`), closeup(o.label), 'utf8');
  }

  console.log(`placeholder room "${ROOM.id}": ${ROOM.bgFrames} bg frames + ${ROOM.objects.length} objects (sprite + closeup each)`);
  console.log(`  -> public/assets/lake-ulysses/sprites/`);
}

build();
