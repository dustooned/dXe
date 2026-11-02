#!/usr/bin/env node
// The social share card (index.html og:image / twitter:image), built from the
// title screen's own art so it never drifts from the game:
//
//   lake  spr_title_bg.png, a VERTICAL sheet of seamless 500x288 tiles; the
//         first tile, scaled to the card's height, repeated sideways (its
//         right edge dissolves into its left, so it tiles with no seam)
//   logo  spr_game_title.png, a horizontal sheet of 640x280 frames; the first
//         frame, centered
//
// Nearest-neighbor throughout so the 1-bit dither stays crisp; saved as a
// small-palette PNG (the art is black and white), well under 300 KB.
//
// Usage: node scripts/make-og-image.mjs   → public/og.png (1200x630)
import sharp from 'sharp';
import { statSync } from 'node:fs';

const TITLE = 'public/assets/shared/title';
const OUT = 'public/og.png';
const W = 1200;
const H = 630;

// ── Lake: first tile, scaled to the card's height, tiled across ──────────
const TILE_W = 500;
const TILE_H = 288;
const tileW = Math.round((TILE_W * H) / TILE_H);
const tile = await sharp(`${TITLE}/spr_title_bg.png`)
  .extract({ left: 0, top: 0, width: TILE_W, height: TILE_H })
  .resize({ width: tileW, height: H, kernel: 'nearest' })
  .png()
  .toBuffer();
const lake = [];
for (let x = 0; x < W; x += tileW) lake.push({ input: tile, left: x, top: 0 });

// ── Logo: first frame of the boil loop, centered ─────────────────────────
const LOGO_W = 640;
const LOGO_H = 280;
const logoW = 960;
const logoH = Math.round((LOGO_H * logoW) / LOGO_W);
const logo = await sharp(`${TITLE}/spr_game_title.png`)
  .extract({ left: 0, top: 0, width: LOGO_W, height: LOGO_H })
  .resize({ width: logoW, height: logoH, kernel: 'nearest' })
  .png()
  .toBuffer();

// The lake runs dim behind the logo, as on the title screen.
const shade = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.45 } } }).png().toBuffer();

await sharp({ create: { width: W, height: H, channels: 3, background: '#000000' } })
  .composite([...lake, { input: shade, left: 0, top: 0 }, { input: logo, left: Math.round((W - logoW) / 2), top: Math.round((H - logoH) / 2) }])
  .png({ palette: true, colours: 16, compressionLevel: 9 })
  .toFile(OUT);

const kb = Math.round(statSync(OUT).size / 1024);
console.log(`${OUT}: ${W}x${H}, ${kb} KB`);
if (kb > 300) { console.error('over the 300 KB budget'); process.exit(1); }
