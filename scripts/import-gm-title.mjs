#!/usr/bin/env node
// One-time import of the title screen from the GameMaker beta: the DREAM
// XTREME logo (spr_game_title, a hand-drawn "boil" loop) and the dithered
// Lake Ulysses panorama behind it (spr_title_bg). Each becomes one
// horizontal sprite sheet (frame N at x = N * width), resized with
// nearest-neighbor so the 1-bit dither stays crisp, as palette PNG.
//
// Usage: node scripts/import-gm-title.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GM = 'E:/2025/Games/BackUp/11_18_2025/DreamXtremeDemo/beta/sprites';
const OUT = 'public/assets/shared/title';
mkdirSync(OUT, { recursive: true });

// [sprite, width out, take every Nth frame]
const SHEETS = [
  ['spr_game_title', 640, 6],
  ['spr_title_bg', 640, 1],
];

for (const [name, width, every] of SHEETS) {
  const yy = readFileSync(join(GM, name, `${name}.yy`), 'utf8').replace(/,(\s*[}\]])/g, '$1');
  const frames = JSON.parse(yy).frames.map((f) => f.name).filter((_, i) => i % every === 0);
  const first = await sharp(join(GM, name, `${frames[0]}.png`)).metadata();
  const height = Math.round((first.height / first.width) * width);
  const tiles = await Promise.all(frames.map((id) =>
    sharp(join(GM, name, `${id}.png`)).resize({ width, height, kernel: 'nearest' }).png().toBuffer()));
  await sharp({ create: { width: width * tiles.length, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles.map((input, i) => ({ input, left: i * width, top: 0 })))
    // The art is 1-bit dither (black, white, clear): a tiny-palette PNG keeps
    // every dot and is far smaller than any WebP of noise.
    .png({ palette: true, colors: 4, compressionLevel: 9 })
    .toFile(join(OUT, `${name}.png`));
  console.log(`${name}: ${tiles.length} frames, ${width}x${height} each`);
}
