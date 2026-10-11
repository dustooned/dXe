#!/usr/bin/env node
// Converts an artist's character GIFs into the game's frame format and writes
// the character's art manifest.
//   node scripts/import-character-gifs.mjs <folder of gifs> <npc>
//   e.g. node scripts/import-character-gifs.mjs art-import/therapist therapist
//
// In:   Profile_<Npc>_<Name>.gif  (192x192, 1-bit look)
//   a one-frame gif is a still; a gif with several frames is an animation.
//   Exported larger? A whole-number multiple (1920x1920 = 10x) is fine: the
//   script checks the upscale is exact (nothing lost) and stores the true size.
//   Odd file names: put a names.json in the folder mapping each file to its
//   state, e.g. {"Profile_Deborah01.gif": "idle", "Samunneutral.gif": "idle"}.
//   (Wins over the naming rules below. Any name that is not a standard state
//   is kept as an extra piece.)
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
// Profile_Deborah_Wait_Anger.gif        -> wait_anger  (a state in engine/characters.js)
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

// Even frames are an fps; frames with their own timings keep each delay.
const timing = (delays, frames) => {
  const d = (delays ?? []).map((x) => x || 100);
  if (d.length === frames && d.some((x) => x !== d[0])) return { delays: d };
  const ms = d.length ? d[0] : 100;
  return { fps: Math.max(1, Math.round(1000 / Math.max(20, ms))) };
};

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
const art = {};
const issues = [];
const namesFile = path.join(src, 'names.json');
const names = fs.existsSync(namesFile) ? JSON.parse(fs.readFileSync(namesFile, 'utf8')) : {};
// One frame of a gif at the true 192x192 (alpha kept), plus how many values an exact downscale lost.
async function frame(gif, i, w, h) {
  const scale = w / 192;
  const one = sharp(gif, { animated: true, page: i, pages: 1 });
  if (scale === 1) return { img: one, lossy: 0 };
  const full = await one.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const small = await sharp(full.data, { raw: full.info }).resize(192, 192, { kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
  const back = await sharp(small.data, { raw: small.info }).resize(w, h, { kernel: 'nearest' }).raw().toBuffer();
  let lossy = 0;
  for (let k = 0; k < back.length; k++) if (back[k] !== full.data[k]) lossy++;
  return { img: sharp(small.data, { raw: small.info }), lossy };
}
for (const file of fs.readdirSync(src).filter((f) => /\.gif$/i.test(f)).sort()) {
  const name = names[file] ?? nameFor(file);
  const gif = path.join(src, file);
  const meta = await sharp(gif, { animated: true }).metadata();
  const frames = meta.pages ?? 1;
  const w = meta.width;
  const h = meta.pageHeight ?? meta.height;
  const scale = w / 192;
  if (!Number.isInteger(scale) || h !== w) { issues.push(`${file}: ${w}x${h}, expected 192x192 (or a whole multiple, like 1920x1920)`); continue; }
  const png = { palette: true, colours: 8, compressionLevel: 9 };
  const dir = path.join(OUT, name);
  if (frames > 1) fs.mkdirSync(dir, { recursive: true });
  let lossy = 0;
  for (let i = 0; i < frames; i++) {
    const f = await frame(gif, i, w, h);
    lossy += f.lossy;
    await f.img.png(png).toFile(frames === 1 ? path.join(OUT, `${name}.png`) : path.join(dir, `${name}_${String(i).padStart(4, '0')}.png`));
  }
  if (lossy) issues.push(`${file}: ${lossy} values changed going to 192x192: not an exact ${scale}x upscale`);
  art[name] = frames === 1 ? { frames: 1 } : { frames, ...timing(meta.delay, frames) };
  if (names[file]) console.log(`${file} -> ${name}${scale > 1 ? ` (${scale}x, exact)` : ''}`);
}
const sorted = Object.fromEntries(Object.entries(art).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(MANIFEST, JSON.stringify({ npc, size: 192, art: sorted }, null, 2) + '\n');
console.log(`${Object.keys(sorted).length} pieces -> ${OUT}`);
console.log(Object.entries(sorted).map(([k, v]) => (v.frames > 1 ? `${k} (${v.frames}f ${v.fps ? `@${v.fps}fps` : v.delays.join('/') + 'ms'})` : k)).join(', '));
if (issues.length) console.log('\nWRONG SIZE:\n' + issues.join('\n'));
