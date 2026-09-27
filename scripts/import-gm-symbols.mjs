#!/usr/bin/env node
// One-time import of Bob Baiter's announcement symbols from the GameMaker
// beta (obj_intro_dialog_symbols). Reads each sprite's .yy for frame order,
// then writes the frames as numbered WebP next to the other lake sprites.
//
// Usage: node scripts/import-gm-symbols.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GM = 'E:/2025/Games/BackUp/11_18_2025/DreamXtremeDemo/beta/sprites';
const OUT = 'public/assets/lake-ulysses/sprites';
const SPRITES = ['spr_biohazard', 'spr_pet_symbol', 'spr_exposure', 'spr_fish', 'spr_baitshop'];

for (const name of SPRITES) {
  // GameMaker .yy files allow trailing commas; strip them before parsing.
  const yy = readFileSync(join(GM, name, `${name}.yy`), 'utf8').replace(/,(\s*[}\]])/g, '$1');
  const frames = JSON.parse(yy).frames.map((f) => f.name);
  mkdirSync(join(OUT, name), { recursive: true });
  for (const [i, id] of frames.entries()) {
    await sharp(join(GM, name, `${id}.png`))
      .webp({ quality: 80, alphaQuality: 70 })
      .toFile(join(OUT, name, `${name}_${String(i).padStart(4, '0')}.webp`));
  }
  console.log(`${name}: ${frames.length} frames`);
}
