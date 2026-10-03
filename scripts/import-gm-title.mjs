#!/usr/bin/env node
// One-time import of the title screen from the GameMaker beta: the DREAM
// XTREME logo (spr_game_title, a hand-drawn "boil" loop) and the dithered
// Lake Ulysses panorama behind it (spr_title_bg).
//
//   logo  a horizontal sprite sheet (frame N at x = N * width)
//   lake  a VERTICAL sheet of seamless tiles (frame N at y = N * height):
//         each frame's right edge dissolves into its left edge with an
//         ordered-dither crossfade, so the tile repeats sideways with no
//         seam and the title can pan it forever (ui.css .dx-title-bg)
//
// Resized with nearest-neighbor so the 1-bit dither stays crisp; saved as
// tiny-palette PNG (black, white, clear), far smaller than WebP of noise.
//
// Usage: node scripts/import-gm-title.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GM = 'E:/2025/Games/BackUp/11_18_2025/DreamXtremeDemo/beta/sprites';
const OUT = 'public/assets/shared/title';
mkdirSync(OUT, { recursive: true });

function framesOf(name, every = 1) {
  const yy = readFileSync(join(GM, name, `${name}.yy`), 'utf8').replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(yy).frames.map((f) => f.name).filter((_, i) => i % every === 0);
}

async function sized(name, id, width) {
  const meta = await sharp(join(GM, name, `${id}.png`)).metadata();
  const height = Math.round((meta.height / meta.width) * width);
  return { width, height, buf: await sharp(join(GM, name, `${id}.png`)).resize({ width, height, kernel: 'nearest' }).ensureAlpha().raw().toBuffer() };
}

const PNG = { palette: true, colors: 4, compressionLevel: 9 };

// ── Logo: horizontal sheet ────────────────────────────────────────────────
{
  const name = 'spr_game_title';
  const width = 640;
  const tiles = [];
  let height = 0;
  for (const id of framesOf(name, 6)) {
    const f = await sized(name, id, width);
    height = f.height;
    tiles.push(await sharp(f.buf, { raw: { width, height, channels: 4 } }).png().toBuffer());
  }
  await sharp({ create: { width: width * tiles.length, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles.map((input, i) => ({ input, left: i * width, top: 0 })))
    .png(PNG)
    .toFile(join(OUT, `${name}.png`));
  console.log(`${name}: ${tiles.length} frames, ${width}x${height}`);
}

// ── Lake: vertical sheet of seamless tiles ────────────────────────────────
{
  const name = 'spr_title_bg';
  const width = 640;
  const OVERLAP = 140; // px of the right edge dissolved into the left
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const frames = [];
  let height = 0;
  for (const id of framesOf(name)) {
    const f = await sized(name, id, width);
    height = f.height;
    const tileW = width - OVERLAP;
    const out = Buffer.alloc(tileW * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < tileW; x++) {
        // In the overlap, each pixel comes from the start or the end of the
        // panorama, picked by a dither threshold that ramps across it.
        let sx = x;
        if (x < OVERLAP) {
          const t = (x + 0.5) / OVERLAP; // 0 → all end, 1 → all start
          if (t <= (BAYER[y % 4][x % 4] + 0.5) / 16) sx = width - OVERLAP + x;
        }
        f.buf.copy(out, (y * tileW + x) * 4, (y * width + sx) * 4, (y * width + sx) * 4 + 4);
      }
    }
    frames.push({ buf: out, tileW });
  }
  const tileW = frames[0].tileW;
  const sheet = Buffer.concat(frames.map((f) => f.buf));
  await sharp(sheet, { raw: { width: tileW, height: height * frames.length, channels: 4 } })
    .png(PNG)
    .toFile(join(OUT, `${name}.png`));
  console.log(`${name}: ${frames.length} seamless frames, ${tileW}x${height}`);
}
