#!/usr/bin/env node
// Recompression pass for the Bob Baiter cutscene's two frame sequences
// (spr_bb, spr_lake_bg_001). Both are re-encoded as tuned lossy WebP at
// their ORIGINAL pixel dimensions — no resize.
//
// A resize step was tried here originally (half resolution + CSS
// image-rendering: pixelated to upscale it back) and reverted. Both
// sequences are dense halftone/dither art (1-bit-style black/white dot
// patterns, not flat-color pixel art) — downscaling that pattern and then
// resampling it back up in the browser causes moire (the dot spacing
// doesn't divide evenly into the upscale factor), which reads as "blurry"
// even with a hard-edge nearest-neighbor kernel on both ends. Confirmed by
// testing nearest vs lanczos3 downscale (byte-identical output at this
// resize ratio — not a kernel problem) and by comparing the browser's
// actual pixelated upscale of the halved source against the same upscale
// from the original: the original reads as fine, crisp grain; the halved
// version reads as a wavy, muddy moire wash. Native resolution avoids the
// mismatch since there's no double resampling.
//
// The tradeoff: at native resolution, lossy quality tuning alone barely
// shrinks spr_lake_bg_001 (dither noise doesn't compress well — there's no
// smooth gradient for the codec to exploit), so that sequence ends up
// close to its original size. spr_bb still saves real space, mostly from
// lossy alpha (its transparency was stored lossless originally).
//
// Usage: node scripts/compress-cutscene-frames.mjs
import sharp from 'sharp';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEQUENCES = [
  { dir: 'public/assets/lake-ulysses/sprites/spr_bb', quality: 75, alphaQuality: 60 },
  { dir: 'public/assets/lake-ulysses/sprites/spr_lake_bg_001', quality: 75, alphaQuality: 60 },
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
    const inputBuffer = readFileSync(path);
    const buffer = await sharp(inputBuffer)
      .webp({ quality, alphaQuality, effort: 6 })
      .toBuffer();

    writeFileSync(path, buffer);
    afterTotal += buffer.length;

    console.log(
      `  ${file}: ${(before / 1024).toFixed(0)}KB -> ${(buffer.length / 1024).toFixed(0)}KB`
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
