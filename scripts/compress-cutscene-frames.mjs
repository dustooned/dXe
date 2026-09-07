#!/usr/bin/env node
// One-off recompression pass for the Bob Baiter cutscene's two frame
// sequences (spr_bb, spr_lake_bg_001) — both were exported at full canvas
// resolution with quality settings tuned for photographic detail this
// 1-bit-styled game doesn't need, and spr_bb's transparency was lossless
// (the single biggest cost per frame). Halves pixel dimensions and switches
// to tuned lossy WebP (lossy alpha included) — smaller files and, paired
// with `image-rendering: pixelated` in CSS, an intentionally chunkier look
// that fits the game's stated aesthetic better than the smooth originals.
//
// Usage: node scripts/compress-cutscene-frames.mjs
import sharp from 'sharp';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEQUENCES = [
  { dir: 'public/assets/lake-ulysses/sprites/spr_bb', quality: 75, alphaQuality: 60 },
  { dir: 'public/assets/lake-ulysses/sprites/spr_lake_bg_001', quality: 70, alphaQuality: 60 },
];

async function compressSequence({ dir, quality, alphaQuality }) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
  let beforeTotal = 0;
  let afterTotal = 0;

  for (const file of files) {
    const path = join(dir, file);
    const before = statSync(path).size;
    beforeTotal += before;

    // Read into memory first — sharp holding a file handle open on `path`
    // while we later write back to that same path deadlocks on Windows.
    // Reading via plain fs and handing sharp a buffer instead means it
    // never touches the file at all until the final writeFileSync.
    const inputBuffer = readFileSync(path);
    const image = sharp(inputBuffer);
    const meta = await image.metadata();
    const targetWidth = Math.round(meta.width / 2);
    const targetHeight = Math.round(meta.height / 2);

    // Default (lanczos3) kernel here on purpose — a clean, anti-aliased
    // shrink. The chunky pixel look comes from the *display* side
    // (image-rendering: pixelated upscaling the smaller source back up),
    // not from a blocky nearest-neighbor downscale, which would just
    // introduce aliasing/moire on detailed frames like the lake background.
    const buffer = await image
      .resize(targetWidth, targetHeight)
      .webp({ quality, alphaQuality, effort: 6 })
      .toBuffer();

    writeFileSync(path, buffer);
    afterTotal += buffer.length;

    console.log(
      `  ${file}: ${(before / 1024).toFixed(0)}KB -> ${(buffer.length / 1024).toFixed(0)}KB ` +
      `(${meta.width}x${meta.height} -> ${targetWidth}x${targetHeight})`
    );
  }

  console.log(
    `${dir}: ${(beforeTotal / 1024 / 1024).toFixed(2)}MB -> ${(afterTotal / 1024 / 1024).toFixed(2)}MB ` +
    `(${files.length} frames)\n`
  );
}

for (const seq of SEQUENCES) {
  console.log(`Compressing ${seq.dir}...`);
  await compressSequence(seq);
}
