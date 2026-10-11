#!/usr/bin/env node
// Converts the artist's chapter-opener GIFs into the game's plate frames.
//   node scripts/import-chapter-plates.mjs <folder of gifs>
//   e.g. node scripts/import-chapter-plates.mjs art-import/chapters
//
// In:   any GIF whose name contains an NPC (Deborah, Rwanda, Samun, Rick; the
//       artist's "Deobrah" typo too) and "Chapter" and "Open".
//       The art is pixel art drawn at 240x150 and exported at a whole-number
//       scale (2400x1500 = 10x); the script finds the scale, checks the
//       upscale is exact (so nothing is lost), and stores the true size.
// Out:  public/assets/lake-ulysses/plates/<npc>/<npc>_0000.png ...  (palette PNG)
//       src/chapters/lake-ulysses/plates.json  (frames and each frame's delay)
// The chapter page (src/scenes/markerScene.js) plays them; an NPC with no plate
// here keeps the code-drawn placeholder (src/ui/plates.js).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: import-chapter-plates.mjs <folder>'); process.exit(1); }

const W = 240;
const H = 150;
const OUT = path.join('public', 'assets', 'lake-ulysses', 'plates');
const MANIFEST = path.join('src', 'chapters', 'lake-ulysses', 'plates.json');
const NPCS = { deborah: /deb?o?r?a?h/i, rwanda: /rwanda/i, samun: /samun/i, rick: /rick/i };

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const problems = [];

for (const file of fs.readdirSync(src).filter((f) => /\.gif$/i.test(f)).sort()) {
  const npc = Object.keys(NPCS).find((k) => NPCS[k].test(file) || (k === 'deborah' && /deobrah/i.test(file)));
  if (!npc || !/chapter/i.test(file)) { problems.push(`${file}: not a chapter-open gif for a known NPC, skipped`); continue; }
  const gif = path.join(src, file);
  const meta = await sharp(gif, { animated: true }).metadata();
  const frames = meta.pages ?? 1;
  const w = meta.width;
  const h = meta.pageHeight ?? meta.height;
  const scale = w / W;
  if (!Number.isInteger(scale) || h !== H * scale) { problems.push(`${file}: ${w}x${h} is not a whole-number multiple of ${W}x${H}`); continue; }
  const dir = path.join(OUT, npc);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let lossy = 0;
  for (let i = 0; i < frames; i++) {
    const full = await sharp(gif, { animated: true, page: i, pages: 1 }).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
    const small = await sharp(full.data, { raw: full.info }).resize(W, H, { kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
    const back = await sharp(small.data, { raw: small.info }).resize(w, h, { kernel: 'nearest' }).raw().toBuffer();
    for (let k = 0; k < back.length; k++) if (back[k] !== full.data[k]) lossy++;
    await sharp(small.data, { raw: small.info }).png({ palette: true, colours: 4, compressionLevel: 9 }).toFile(path.join(dir, `${npc}_${String(i).padStart(4, '0')}.png`));
  }
  if (lossy) problems.push(`${file}: ${lossy} values changed going to ${W}x${H}: the art is not an exact ${scale}x upscale`);
  manifest[npc] = { frames, delays: (meta.delay ?? []).map((d) => d || 100), size: [W, H] };
  console.log(`${npc}: ${frames} frames, ${manifest[npc].delays.join('/')} ms  (${file}, ${scale}x)`);
}

fs.writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
if (problems.length) console.log('\nCHECK:\n' + problems.join('\n'));
