#!/usr/bin/env node
// Converts an artist's character GIFs into the game's frame format and writes
// the character's art manifest.
//   node scripts/import-character-gifs.mjs <folder of gifs> <npc>
//   e.g. node scripts/import-character-gifs.mjs art-import/therapist therapist
//
// In:   Profile_<Npc>_<Name>.gif  (192x192, 1-bit look, transparent)
//   a one-frame gif is a still; a gif with several frames is an animation.
// Out:  public/assets/lake-ulysses/characters/<npc>/<name>.png          (stills)
//       public/assets/lake-ulysses/characters/<npc>/<name>/<name>_0000.png ... (animations)
//       src/chapters/lake-ulysses/characters/<npc>.json                 (what exists, frame counts, fps)
// Palette PNG, not WebP: this art is 1-bit, and a palette PNG is smaller and
// stays pixel-exact. Names are normalized (see nameFor), so the game's states
// (src/engine/characters.js) can find them.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [src, npc] = process.argv.slice(2);
if (!src || !npc) { console.error('usage: import-character-gifs.mjs <folder> <npc>'); process.exit(1); }

const OUT = path.join('public', 'assets', 'lake-ulysses', 'characters', npc);
const MANIFEST = path.join('src', 'chapters', 'lake-ulysses', 'characters', `${npc}.json`);

// Profile_Therapist_Old_Man_Hat_Ani.gif -> old_man_talk
// Profile_Therapist_Top_Hat02.gif       -> top_2
// Profile_Deborah_Feel_Anger.gif        -> feel_anger  (a state in engine/characters.js)
// Profile_Therapist_Neutral01.gif       -> neutral_1
// Profile_Therapist_Neutral_Hat03.gif   -> neutral_3   (a mis-named Neutral03)
function nameFor(file) {
  let n = file.replace(/\.gif$/i, '').replace(new RegExp(`^Profile_${npc}_`, 'i'), '');
  if (/^(talk|ani)$/i.test(n)) return 'talk'; // Profile_Deborah_Talk.gif, or ..._Ani.gif
  const ani = /_Ani$/i.test(n);
  n = n.replace(/_Ani$/i, '').replace(/_?Hat(\d+)?$/i, (m, d) => (d ? d : '')).replace(/_$/, '');
  const num = n.match(/(\d+)$/);
  const base = n.replace(/_?\d+$/, '').toLowerCase();
  if (ani) return base ? `${base}_talk` : 'talk';
  return num ? `${base}_${Number(num[1])}` : base;
}

const fps = (delays) => {
  const ms = delays?.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 100;
  return Math.max(1, Math.round(1000 / Math.max(20, ms)));
};

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
const art = {};
const issues = [];
for (const file of fs.readdirSync(src).filter((f) => /\.gif$/i.test(f)).sort()) {
  const name = nameFor(file);
  const meta = await sharp(path.join(src, file), { animated: true }).metadata();
  const frames = meta.pages ?? 1;
  const h = meta.pageHeight ?? meta.height;
  if (meta.width !== 192 || h !== 192) issues.push(`${file}: ${meta.width}x${h}, expected 192x192`);
  const png = { palette: true, colours: 8, compressionLevel: 9 };
  if (frames === 1) {
    await sharp(path.join(src, file)).png(png).toFile(path.join(OUT, `${name}.png`));
    art[name] = { frames: 1 };
  } else {
    const dir = path.join(OUT, name);
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < frames; i++) {
      await sharp(path.join(src, file), { animated: true, page: i, pages: 1 }).png(png).toFile(path.join(dir, `${name}_${String(i).padStart(4, '0')}.png`));
    }
    art[name] = { frames, fps: fps(meta.delay) };
  }
}
const sorted = Object.fromEntries(Object.entries(art).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(MANIFEST, JSON.stringify({ npc, size: 192, art: sorted }, null, 2) + '\n');
console.log(`${Object.keys(sorted).length} pieces -> ${OUT}`);
console.log(Object.entries(sorted).map(([k, v]) => (v.frames > 1 ? `${k} (${v.frames}f @${v.fps}fps)` : k)).join(', '));
if (issues.length) console.log('\nWRONG SIZE:\n' + issues.join('\n'));
