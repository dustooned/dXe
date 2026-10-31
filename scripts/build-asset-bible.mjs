#!/usr/bin/env node
// Builds the production asset bible: docs/ASSET_BIBLE.html, .pdf and .csv.
//
//   npm run asset-bible
//
// Every asset the game could use, one square thumbnail each (the real image
// where it exists, a marked placeholder tile where it doesn't), with its
// status (have / placeholder / missing / code), size, file path and the scene
// that uses it. Nothing is typed in by hand that the game can tell us: the
// character states come from src/engine/characters.js, what is drawn from the
// character manifests and the files on disk, plates from plates.json, feed
// channels and morning-after variants from the content JSON, sound effects and
// stings from src/shell/audio.js, rooms from the files in sprites/. Re-run it
// after any art lands. The PDF is printed with headless Edge or Chrome.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { STATES, STATE_NAMES, THERAPIST_HATS } from '../src/engine/characters.js';
import { EMOTION_ORDER } from '../src/engine/loadout.js';
import { ICONS } from '../src/ui/feelingIcons.js';
import { ROWS as PASTOR_ROWS, COLORS as PASTOR_COLORS } from '../src/ui/pastorBust.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(ROOT, ...p);
const read = (p) => fs.readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(read(p));
const exists = (p) => fs.existsSync(p);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CH = rel('src', 'chapters', 'lake-ulysses');
const PUB = rel('public', 'assets');
const LU = path.join(PUB, 'lake-ulysses');
const SHARED = path.join(PUB, 'shared');
const urlPath = (abs) => '/' + path.relative(rel('public'), abs).split(path.sep).join('/');
const NAME = (n) => n.charAt(0).toUpperCase() + n.slice(1);
const NPCS = ['deborah', 'rwanda', 'samun', 'rick'];
const FEELINGS = EMOTION_ORDER.map((e) => e.toLowerCase());

// ── Items ───────────────────────────────────────────────────────────────────
// status: have (final art on disk) | placeholder (on disk, to be replaced)
//         | missing (nothing on disk) | code (drawn or synthesised by code)
const sections = [];
function section(id, title, blurb) {
  const s = { id, title, blurb, groups: [] };
  sections.push(s);
  return {
    group(name, note = '') {
      const g = { name, note, items: [] };
      s.groups.push(g);
      return (it) => g.items.push({ section: title, group: name, ...it });
    },
  };
}

// ── Thumbnails ──────────────────────────────────────────────────────────────
const TH = 144;
async function thumb(file, { frameOf = null } = {}) {
  try {
    const buf = await sharp(file, { density: 96 }).resize(TH, TH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'nearest' }).png({ palette: true, compressionLevel: 9 }).toBuffer();
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch { return null; }
}
async function sizeOf(file) {
  try { const m = await sharp(file, { density: 96 }).metadata(); return [m.width, m.height]; } catch { return null; }
}
const dims = (wh) => (wh ? `${wh[0]} × ${wh[1]}` : '');

// ── 1. Characters ───────────────────────────────────────────────────────────
function stateUse(state) {
  if (state === 'idle') return 'Dialog, phone call, confrontation: the rest face';
  if (state === 'talk') return 'Dialog: while their quoted words type';
  if (state.startsWith('talk_')) return `Dialog: speaking in ${state.slice(5)}`;
  if (state.startsWith('wait_')) return `Dialog: your turn, feeling ${state.slice(5)}`;
  if (state === 'react_cold') return 'Dialog: they close up (not wired yet)';
  if (state.startsWith('react_')) return `Dialog: your answer lands (${state.slice(6)})`;
  if (state === 'connect') return 'Encounter end: stay in touch (not wired yet)';
  if (state === 'pushaway') return 'Encounter end: pushed away (not wired yet)';
  if (state.startsWith('trauma_')) return `Confession, story beat ${state.slice(7)} (not wired yet)`;
  return '';
}
function frameFile(dir, state, n, i = 0) {
  return n === 1 ? path.join(dir, `${state}.png`) : path.join(dir, state, `${state}_${String(i).padStart(4, '0')}.png`);
}
// Which feelings does the NPC actually show in battle? (a node's MASK, else MOOD)
function shownFeelings(npc) {
  const f = path.join(CH, 'content', `${npc}.json`);
  if (!exists(f)) return new Set();
  const out = new Set();
  for (const n of Object.values(readJson(f).nodes ?? {})) { const x = n.mask ?? n.mood; if (x) out.add(x.toLowerCase()); }
  return out;
}

async function characters() {
  const S = section('characters', 'NPC character states', 'Each NPC: 192 × 192, 1-bit look (black pixel art on white), GIF or PNG. Per docs/CHARACTER_ART.md. Talk and wait pieces for a feeling the NPC never shows in a battle are marked optional.');
  for (const npc of [...NPCS, 'therapist']) {
    const dir = path.join(LU, 'characters', npc);
    const mFile = path.join(CH, 'characters', `${npc}.json`);
    const art = exists(mFile) ? readJson(mFile).art : {};
    const shown = shownFeelings(npc);
    const push = S.group(`${NAME(npc)}`, npc === 'therapist'
      ? 'Voice first; per hat: three stills (_1 _2 _3) and a talk loop. Bare-headed is "neutral".'
      : `Shows ${shown.size ? [...shown].join(', ') : 'n/a'} in battle. Folder: public/assets/lake-ulysses/characters/${npc}/`);
    const seen = new Set();
    const names = npc === 'therapist'
      ? [...['neutral', ...THERAPIST_HATS].flatMap((h) => [`${h}_1`, `${h}_2`, `${h}_3`, `${h}_talk`])]
      : STATE_NAMES;
    for (const st of names) {
      seen.add(st);
      const a = art[st];
      const feeling = st.match(/^(?:talk|wait)_(\w+)$/)?.[1];
      const optional = npc !== 'therapist' && feeling && !shown.has(feeling);
      const frames = a?.frames ?? (st.endsWith('_talk') || st === 'talk' || st.startsWith('talk_') ? 3 : 1);
      push({
        name: st, status: a ? 'have' : 'missing', optional: !!optional,
        size: '192 × 192', frames: a ? a.frames : frames,
        path: `characters/${npc}/${a ? (a.frames === 1 ? `${st}.png` : `${st}/${st}_0000.png…`) : `${st}  ← Profile_${NAME(npc)}_${st.split('_').map(NAME).join('_')}.gif`}`,
        scene: npc === 'therapist' ? 'Phone calls, tutorial, "you again" call' : stateUse(st),
        thumb: a ? await thumb(frameFile(dir, st, a.frames)) : null,
      });
    }
    for (const [st, a] of Object.entries(art)) {
      if (seen.has(st)) continue;
      push({
        name: st, status: 'have', size: '192 × 192', frames: a.frames, extra: true,
        path: `characters/${npc}/${a.frames === 1 ? `${st}.png` : `${st}/${st}_0000.png…`}`,
        scene: 'Extra piece received, not a state yet',
        thumb: await thumb(frameFile(dir, st, a.frames)),
      });
    }
  }
}

// ── 2. Chapter plates ───────────────────────────────────────────────────────
async function plates() {
  const S = section('plates', 'Chapter plates', 'The novel page before each room: 240 × 150 true pixels, animated, flat (bands, scanlines and tape border are added in code). scripts/import-chapter-plates.mjs writes plates/<npc>/<npc>_NNNN.png.');
  const push = S.group('Plates I–IV');
  const pj = readJson(path.join(CH, 'plates.json'));
  const idx = fs.readFileSync(path.join(CH, 'index.js'), 'utf8');
  const roman = { deborah: 'I', rwanda: 'II', samun: 'III', rick: 'IV' };
  for (const npc of NPCS) {
    const p = pj[npc];
    const file = path.join(LU, 'plates', npc, `${npc}_0000.png`);
    const marker = idx.match(new RegExp(`id: '${npc}-marker'[^]*?plate: "([^"]+)"`))?.[1] ?? '';
    push({
      name: `${npc} plate ${roman[npc]}`, status: p && exists(file) ? 'have' : 'missing',
      size: p ? `${p.size.join(' × ')}` : '240 × 150', frames: p?.frames ?? '3 to 7',
      path: `plates/${npc}/${npc}_0000.png…`, scene: `${npc}-marker scene${marker ? ` ("${marker}")` : ''}`,
      thumb: p && exists(file) ? await thumb(file) : null,
    });
  }
}

// ── 3. Battle, cutscene and feed art ────────────────────────────────────────
// Every art reference found in a chapter content JSON, so the table follows the script.
function contentUses() {
  const dir = path.join(CH, 'content');
  const by = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const txt = read(path.join(dir, f));
    const found = new Set();
    for (const m of txt.matchAll(/"(bgAnim|spriteAnim|image|sprite|art|plate)":\s*"([^"]+)"/g)) found.add(`${m[1]}: ${m[2]}`);
    by[f.replace('.json', '')] = [...found];
  }
  return by;
}

async function anim(key) {
  const a = readAnims();
  const c = a[key];
  if (!c) return null;
  return c;
}
let _anims = null;
function readAnims() {
  if (_anims) return _anims;
  const txt = read(path.join(CH, 'anims.js'));
  _anims = {};
  for (const m of txt.matchAll(/(\w+):\s*\{\s*base:\s*`\$\{BASE\}([^`]+)`,\s*frames:\s*(\d+),\s*fps:\s*(\d+)/g)) {
    _anims[m[1]] = { base: m[2], frames: +m[3], fps: +m[4] };
  }
  return _anims;
}
function animFile(key, i = 0) {
  const c = readAnims()[key];
  if (!c) return null;
  const stem = path.join(LU, 'sprites', c.base + String(i).padStart(4, '0'));
  return ['.webp', '.png', '.svg'].map((e) => stem + e).find(exists) ?? null;
}

async function battleArt() {
  const S = section('scenes', 'Cutscene, feed and battle art', 'The art on the full-screen scenes: cutscenes, the FEELZ install and feed, the confrontations, the endings. Anything drawn in code is marked code.');
  const uses = contentUses();

  const cs = S.group('Cutscene backgrounds and figures', 'From the script: every picture a content file asks for.');
  const csScenes = [
    ['it_intro', 'it-intro', 'IT intro'], ['opening_quote', 'opening-quote', 'Opening quote'], ['prologue', 'prologue', 'Prologue'],
    ['feelz_install', 'feelz-install', 'FEELZ install scene'], ['feelz_launch', 'feelz-launch', 'FEELZ launch'], ['walk_home', 'walk-home', 'Walk home'],
    ['confront_deborah', 'deborah-confront', 'Confrontation: Deborah'], ['confront_rwanda', 'rwanda-confront', 'Confrontation: Rwanda'],
    ['confront_samun', 'samun-confront', 'Confrontation: Samun'], ['confront_rick', 'rick-confront', 'Confrontation: Rick'],
    ['bob_baiter', 'feed (Bob channel)', 'Bob Baiter broadcast'], ['pastor', 'reckoning', 'Pastor Gabriel reckoning'], ['endings', 'ending', 'Endings'],
  ];
  for (const [file, scene, label] of csScenes) {
    const u = uses[file] ?? [];
    const refs = u.map((x) => x.split(': ')[1]);
    let first = null; let status = 'code'; let note = '';
    const kinds = [];
    for (const ref of [...new Set(refs)]) {
      if (ref === 'lakeGauge' || ref === 'feelzSilhouette') { kinds.push(`${ref} (code)`); continue; }
      if (ref.startsWith('/assets/')) {
        const f = rel('public', ref);
        kinds.push(`${path.basename(ref)}${/npc_/.test(ref) ? ' (placeholder bust)' : ''}`);
        if (exists(f) && !first) { first = f; status = /npc_|prologue-lake/.test(ref) ? 'placeholder' : 'have'; }
        else if (!exists(f)) status = 'missing';
        continue;
      }
      if (readAnims()[ref]) { kinds.push(`${ref} (${readAnims()[ref].frames}f)`); const f = animFile(ref); if (f && !first) { first = f; status = 'have'; } continue; }
      kinds.push(ref);
    }
    cs({
      name: label, status: kinds.length ? status : 'code', size: first ? dims(await sizeOf(first)) : '', frames: '',
      path: kinds.join(', ') || 'text on black / UI only', scene,
      thumb: first ? await thumb(first) : null,
    });
  }
  // Bobs's sprite, lake, quote background (named anims)
  const an = S.group('Animated backgrounds and characters (anims.js)');
  const label = { lake_bg: 'Lake (cutscene background)', quote_bg: 'Opening-quote background', bob_baiter: 'Bob Baiter (broadcast)' };
  const where = { lake_bg: 'Cutscenes, Bob channel', quote_bg: 'Opening quote', bob_baiter: 'Feed: Bob channel' };
  for (const k of ['lake_bg', 'quote_bg', 'bob_baiter']) {
    const f = animFile(k);
    an({ name: label[k], status: f ? 'have' : 'missing', size: f ? dims(await sizeOf(f)) : '780 × 1688', frames: readAnims()[k].frames, path: `sprites/${readAnims()[k].base}NNNN`, scene: where[k], thumb: f ? await thumb(f) : null });
  }

  // Feed channels
  const fd = S.group('FEELZ feed channels (opening feed and morning after)', 'One picture per channel, 780 × 1688, 4 to 12 frames, looping. The same picture plays in the morning-after feed.');
  const feed = readJson(path.join(CH, 'content', 'feed.json'));
  const chans = [{ id: 'bob', name: 'BOB BAITER' }, ...feed.channels];
  for (const ch of chans) {
    let f = null; let status = 'missing'; let p = `sprites/spr_feed_${ch.id}/spr_feed_${ch.id}_0000.webp`; let note = '';
    if (ch.id === 'bob') { f = animFile('bob_baiter'); status = 'have'; p = 'sprites/spr_bb/ + spr_lake_bg_001/'; }
    else if (ch.plate) { f = path.join(LU, 'plates', ch.plate, `${ch.plate}_0000.png`); status = exists(f) ? 'placeholder' : 'missing'; p = `plates/${ch.plate}/ (the chapter plate stands in)`; }
    else { const g = path.join(LU, 'sprites', `spr_feed_${ch.id}`, `spr_feed_${ch.id}_0000.webp`); if (exists(g)) { f = g; status = 'have'; } }
    fd({
      name: `${ch.name}${ch.tag ? ` (${ch.tag})` : ''}`, status, size: ch.id === 'bob' ? '780 × 1688' : (ch.plate ? '240 × 150 (plate)' : '780 × 1688'), frames: '4 to 12',
      path: p, scene: 'Feed scene, morning-after feed', thumb: f && exists(f) ? await thumb(f) : null,
    });
  }

  // Feed music
  const fm = S.group('Feed channel music', 'Placeholder synth per channel (shell/feedMusic.js). Real tracks: an mp3 loop each, mixed already sounding like its device.');
  const fmText = read(rel('src', 'shell', 'feedMusic.js'));
  const fmNote = { bob: 'the lake (lk_01.mp3 ambient)', ad: 'FEELZ ad jingle', grade: "documentary's icy bells", pastor: 'organ on a TV', barlot: 'bass through the wall', wall: "Rwanda's MIDI pop on a little Bluetooth speaker", fixes: "Samun's 60s soul on a crappy radio" };
  for (const ch of chans) fm({ name: `${ch.name} music`, status: ch.id === 'bob' ? 'have' : 'placeholder', size: '', path: ch.id === 'bob' ? 'audio/lk_01.mp3' : `(synth in shell/feedMusic.js, ${fmText.includes(ch.id) ? 'yes' : 'check'})`, scene: `Feed: ${fmNote[ch.id] ?? ''}`, thumb: null, audio: true });

  // Morning-after variants
  const mv = S.group('Morning-after variants', 'Text variants only: each plays over its channel\'s picture above, so no extra art is needed. The first whose condition holds plays.');
  const epi = readJson(path.join(CH, 'content', 'feed_epilogue.json'));
  for (const ch of epi.channels) {
    ch.variants.forEach((v, i) => mv({
      name: `${ch.id} · ${Object.entries(v.when ?? {}).map(([k, x]) => `${k}=${Array.isArray(x) ? x.join('/') : x}`).join(' ') || 'default'}`,
      status: 'have', size: '', path: 'content/feed_epilogue.json (text; picture = the channel\'s)', scene: 'morning-feed', thumb: null, textOnly: true,
    }));
  }

  // Endings
  const en = S.group('Endings', 'Today the ending slides are text on black (one line per slide, then the epilogue). Optional slide art: 800 × 600 WebP in public/assets/lake-ulysses/endings/.');
  const endings = readJson(path.join(CH, 'content', 'endings.json'));
  for (const k of Object.keys(endings).filter((x) => x !== 'epilogues')) {
    const art = path.join(LU, 'endings', `${k.toLowerCase()}.webp`);
    en({ name: `${endings[k].title} (${endings[k].range})`, status: exists(art) ? 'have' : 'missing', optional: true, size: '800 × 600', path: `endings/${k.toLowerCase()}.webp`, scene: 'ending', thumb: exists(art) ? await thumb(art) : null });
  }
  for (const k of Object.keys(endings.epilogues)) en({ name: `Epilogue slide: ${k}`, status: 'code', size: '', path: 'text slide (endings.json epilogues)', scene: 'ending', thumb: null, textOnly: true });
}

// ── 4. UI, HUD, lake and fish, minigames ───────────────────────────────────
function gridSvg(rows, colorOf, cell) {
  const w = rows[0].length * cell; const h = rows.length * cell; let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = colorOf(ch); if (c) r += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${c}"/>`; }));
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${r}</svg>`);
}
async function svgThumb(buf) {
  const png = await sharp(buf).resize(TH, TH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'nearest' }).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function uiArt() {
  const css = read(rel('src', 'style.css'));
  const hex = (v) => css.match(new RegExp(`--${v}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1] ?? '#fff';
  const S = section('ui', 'UI, HUD, lake and fish', 'Pixel art drawn in code is rendered here from its data so it can be seen and redrawn. Files on disk are listed with their real size.');

  const ic = S.group('Feeling icons (code-drawn pixel grids, src/ui/feelingIcons.js)', 'Drawn as pixel rows, tinted by the feeling colour in game.');
  for (const [name, rows] of Object.entries(ICONS)) {
    ic({ name: `feeling icon: ${name}`, status: 'code', size: `${rows[0].length} × ${rows.length} grid`, path: 'src/ui/feelingIcons.js', scene: 'Wheel, HUD, dialog chips, FEELZ', thumb: await svgThumb(gridSvg(rows, (c) => (c === '#' ? hex(`color-feelz-${name.toLowerCase()}`) : null), 16)) });
  }
  const hud = S.group('Characters drawn in code');
  hud({ name: 'Pastor Gabriel bust', status: 'code', size: `${PASTOR_ROWS[0].length} × ${PASTOR_ROWS.length} grid (real bust: 480 × 384)`, path: 'src/ui/pastorBust.js', scene: 'Reckoning', thumb: await svgThumb(gridSvg(PASTOR_ROWS, (c) => PASTOR_COLORS[c] ?? null, 16)) });
  const itf = path.join(SHARED, 'sprites', 'spr_it_icon.png');
  const sof = path.join(SHARED, 'sprites', 'spr_so_icon.png');
  hud({ name: 'IT icon', status: exists(itf) ? 'have' : 'missing', size: exists(itf) ? dims(await sizeOf(itf)) : '? (GIF in art-import/it-so/DX_IT_Icon.gif, not imported)', path: 'shared/sprites/spr_it_icon.png', scene: 'IT popups (ui/itPopup.js)', thumb: exists(itf) ? await thumb(itf) : null });
  hud({ name: 'SO icon', status: exists(sof) ? 'have' : 'missing', size: exists(sof) ? dims(await sizeOf(sof)) : '? (GIF in art-import/it-so/DX_SO_Icon.gif, not imported)', path: 'shared/sprites/spr_so_icon.png', scene: 'SO popups (ui/itPopup.js)', thumb: exists(sof) ? await thumb(sof) : null });
  for (const [n, f, sc] of [['Favicon', 'favicon.png', 'Browser tab'], ['Apple touch icon', 'apple-touch-icon.png', 'Home-screen icon']]) {
    const abs = rel('public', f);
    hud({ name: n, status: exists(abs) ? 'have' : 'missing', size: exists(abs) ? dims(await sizeOf(abs)) : '180 × 180', path: f, scene: sc, thumb: exists(abs) ? await thumb(abs) : null });
  }
  for (const [n, f, sc] of [
    ['Lake gauge', 'src/ui/lakeGauge.js', 'Cutscenes and HUD: the lake as a drawn gauge'], ['Oscilloscope', 'src/ui/oscilloscope.js', 'Feeling readout'],
    ['FEELZ silhouette / dartboard / report', 'src/ui/feelzSilhouette.js, feelzDartboard.js, feelzReport.js, feelzRecord.js', 'FEELZ check-in and record'],
    ['Meters (battery, Bars, Wi-Fi, clock)', 'src/ui/statusBar.js', 'Status bar / HUD'], ['Swipe card, quick beat, ripple, spotlight', 'src/ui/swipeCard.js, quickBeat.js, ripple.js, spotlight.js', 'Minigames and dialog'],
    ['QR code', 'src/ui/qrCode.js (qrcode-generator)', 'FEELZ install'],
  ]) hud({ name: n, status: 'code', size: '', path: f, scene: sc, thumb: null, textOnly: true });

  const lk = S.group('Lake, fish and Bob\'s announcement symbols', 'From the GameMaker beta (scripts/import-gm-symbols.mjs).');
  const symbols = [['Lake (cutscene bg)', 'spr_lake_bg_001', 'Cutscenes'], ['Opening quote bg', 'spr_QuoteBG', 'Opening quote'], ['Bob Baiter', 'spr_bb', 'Feed: Bob'], ['Fish symbol', 'spr_fish', "Bob's announcement"], ['Biohazard symbol', 'spr_biohazard', "Bob's announcement"], ['Bait shop symbol', 'spr_baitshop', "Bob's announcement"], ['Exposure symbol', 'spr_exposure', "Bob's announcement"], ['Pet symbol', 'spr_pet_symbol', "Bob's announcement"]];
  for (const [n, d, sc] of symbols) {
    const dir = path.join(LU, 'sprites', d);
    const files = exists(dir) ? fs.readdirSync(dir).filter((x) => /\.(webp|png|svg)$/.test(x)).sort() : [];
    const f0 = files[0] ? path.join(dir, files[0]) : null;
    lk({ name: n, status: f0 ? 'have' : 'missing', size: f0 ? dims(await sizeOf(f0)) : '', frames: files.length, path: `sprites/${d}/${d}_NNNN`, scene: sc, thumb: f0 ? await thumb(f0) : null });
  }

  const mg = S.group('Mini-game rooms (hallway, alley, garage, bar lot)', 'All room art is a code-generated PLACEHOLDER (scripts/make-placeholder-room.mjs). Replace at the same path. Backgrounds 6 frames, objects white-line on transparent, close-ups 780 × 1440.');
  const rooms = [['hallway', 'Deborah', 'deborah-hallway', ['diploma', 'doormat', 'lightbulb'], 'door'], ['alley', 'Rwanda', 'rwanda-alley', ['neon', 'payphone', 'mural'], 'gate'], ['garage', 'Samun', 'samun-garage', ['drum', 'calendar', 'radio'], 'bay'], ['barlot', 'Rick', 'rick-barlot', ['bike', 'ashtray', 'flyer'], 'door']];
  for (const [room, npc, scene, objs, adv] of rooms) {
    const bg0 = path.join(LU, 'sprites', `spr_${room}_bg`, `spr_${room}_bg_0000.svg`);
    mg({ name: `${room} background (6 frames)`, status: exists(bg0) ? 'placeholder' : 'missing', size: exists(bg0) ? dims(await sizeOf(bg0)) + ' (draw 780 × 1688)' : '780 × 1688', frames: 6, path: `sprites/spr_${room}_bg/spr_${room}_bg_0000…0005`, scene, thumb: exists(bg0) ? await thumb(bg0) : null });
    for (const o of [...objs, adv]) for (const cl of o === adv ? [''] : ['', '_closeup']) {
      const f = path.join(LU, 'sprites', `${room}_${o}${cl}.svg`);
      mg({ name: `${room}_${o}${cl}${o === adv && !cl ? ' (the way on)' : ''}`, status: exists(f) ? 'placeholder' : 'missing', size: exists(f) ? dims(await sizeOf(f)) : '', path: `sprites/${room}_${o}${cl}.svg`, scene: `${scene} (${npc})`, thumb: exists(f) ? await thumb(f) : null });
    }
  }
  const bu = S.group('Confrontation busts and dialog portraits', 'Busts are bottom-anchored, 600 × 1200. Portraits are 192 × 192 (the NPC state art above now fills this job).');
  for (const npc of NPCS) {
    const f = path.join(LU, 'sprites', `npc_${npc}.svg`);
    bu({ name: `npc_${npc} bust`, status: exists(f) ? 'placeholder' : 'missing', size: exists(f) ? dims(await sizeOf(f)) + ' (draw 600 × 1200)' : '600 × 1200', path: `sprites/npc_${npc}.svg`, scene: `${npc}-confront`, thumb: exists(f) ? await thumb(f) : null });
  }
  for (const npc of NPCS) {
    const f = path.join(LU, 'sprites', `portrait_${npc}.webp`);
    bu({ name: `portrait_${npc}`, status: exists(f) ? 'have' : 'missing', optional: true, size: '192 × 192', path: `sprites/portrait_${npc}.webp`, scene: 'Dialog (superseded by the character state art when present)', thumb: exists(f) ? await thumb(f) : null });
  }
  const bg = S.group('Backgrounds');
  const pl = path.join(LU, 'backgrounds', 'prologue-lake.svg');
  bg({ name: 'prologue-lake', status: exists(pl) ? 'placeholder' : 'missing', size: exists(pl) ? dims(await sizeOf(pl)) + ' (draw 780 × 1688)' : '780 × 1688', path: 'backgrounds/prologue-lake.svg', scene: 'prologue', thumb: exists(pl) ? await thumb(pl) : null });
}

// ── 5. Title, GM symbols, fonts ─────────────────────────────────────────────
async function titleFonts() {
  const S = section('title', 'Title, logos and fonts');
  const t = S.group('Title and logos');
  const logo = path.join(SHARED, 'title', 'spr_game_title.png');
  const bgf = path.join(SHARED, 'title', 'spr_title_bg.png');
  const lm = exists(logo) ? await sizeOf(logo) : null;
  t({ name: 'Game title logo (13 frames, sheet)', status: exists(logo) ? 'have' : 'missing', size: lm ? `${lm[0]} × ${lm[1]} sheet (640 × 280 a frame)` : '1260 × 551 a frame', frames: 13, path: 'shared/title/spr_game_title.png', scene: 'Title screen', thumb: exists(logo) ? await (async () => { const b = await sharp(logo).extract({ left: 0, top: 0, width: 640, height: 280 }).resize(TH, TH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'nearest' }).png().toBuffer(); return `data:image/png;base64,${b.toString('base64')}`; })() : null });
  const bm = exists(bgf) ? await sizeOf(bgf) : null;
  t({ name: 'Title lake banner (7 tiles, vertical sheet)', status: exists(bgf) ? 'have' : 'missing', size: bm ? `${bm[0]} × ${bm[1]} sheet (500 × 288 a tile)` : '1280 × 576 a frame', frames: 7, path: 'shared/title/spr_title_bg.png', scene: 'Title screen, chapter banner', thumb: exists(bgf) ? await (async () => { const b = await sharp(bgf).extract({ left: 0, top: 0, width: 500, height: 288 }).resize(TH, TH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'nearest' }).png().toBuffer(); return `data:image/png;base64,${b.toString('base64')}`; })() : null });
  for (const f of ['spr_inkflo_logo.mp4', 'spr_inkflo_logo.webm']) {
    const abs = path.join(SHARED, 'sprites', f);
    t({ name: `Inkflo studio logo (${path.extname(f).slice(1)})`, status: exists(abs) ? 'have' : 'missing', size: exists(abs) ? `${Math.round(fs.statSync(abs).size / 1024)} KB video` : '', path: `shared/sprites/${f}`, scene: 'Preloader / logo sting', thumb: null, video: true });
  }
  const fo = S.group('Fonts', 'Both are web fonts loaded by @import from Google Fonts in src/style.css (public/assets/shared/fonts is empty). Bundle them for an offline build.');
  for (const [n, v, use] of [['Press Start 2P', '--font-pixel', 'Everything: text, buttons, HUD'], ['VT323', '--font-it', 'IT and SO voices, terminal screens']]) {
    fo({ name: n, status: 'have', size: '', path: `Google Fonts @import (${v})`, scene: use, thumb: null, font: n });
  }
}

// ── 6. Audio ────────────────────────────────────────────────────────────────
function grepSrc(needle) {
  const hits = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|json|css)$/.test(e.name) && read(p).includes(needle)) hits.add(path.relative(rel('src'), p).split(path.sep).join('/'));
    }
  };
  walk(rel('src'));
  return [...hits];
}
function countSrc(re) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|json)$/.test(e.name)) n += (read(p).match(re) ?? []).length;
    }
  };
  walk(rel('src', 'chapters'));
  walk(rel('src', 'ui'));
  walk(rel('src', 'scenes'));
  return n;
}

async function audio() {
  const S = section('audio', 'Audio', 'Text table only. Final music = FL-exported audio; the browser synth is for UI sounds (docs/MUSIC_PIPELINE.md).');
  const files = S.group('Audio files on disk');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const mp3s = walk(PUB).filter((f) => /\.(mp3|ogg|wav)$/.test(f)).sort();
  const kind = { 'lk_01.mp3': 'Ambient bed: the lake', 'ann_01.mp3': 'Bob Baiter announcement bed', 'heavens_waiting_room.mp3': 'Therapist hold music (questionnaire)', 'it_sting.mp3': 'IT sting', 'tyagl.mp3': 'Sting', 'snd_inkflo_logo.mp3': 'Studio logo sting', 'snd_lake_title.mp3': 'Title: lake ambience', 'snd_start.mp3': 'Title: start sting', 'snd_titlemusic.mp3': 'Title music', 'typewriter_tick.mp3': 'Typewriter tick' };
  for (const f of mp3s) {
    const b = path.basename(f);
    const used = grepSrc(b);
    files({ name: b, status: 'have', size: `${Math.round(fs.statSync(f).size / 1024)} KB`, path: urlPath(f).replace('/assets/', ''), scene: `${kind[b] ?? ''}${used.length ? ` · used by ${used.join(', ')}` : ' · not referenced'}`, thumb: null, audio: true });
  }

  const ost = S.group('Battle music (OST): FL-exported stems per NPC', 'Folder public/assets/lake-ulysses/music/<npc>/. Per MUSIC_PIPELINE.md: intro, phase1…4 (each at its real tempo), secret. Until stems land, battles play synth placeholders (shell/battleMusic.js, encounterMusic.js, arrangementVoices.js).');
  const arr = path.join(CH, 'content', 'arrangements');
  for (const npc of [...NPCS, 'therapist']) {
    const has = exists(path.join(arr, `${npc}.json`));
    const dirExists = exists(path.join(LU, 'music', npc));
    const parts = has ? readJson(path.join(arr, `${npc}.json`)).parts.map((p) => p.label).join(', ') : '';
    for (const stem of (npc === 'therapist' ? ['hold-music (heavens_waiting_room.mp3 serves)'] : ['intro', 'phase1', 'phase2', 'phase3', 'phase4', 'secret'])) {
      const f = path.join(LU, 'music', npc, `${stem}.ogg`);
      ost({ name: `${npc} · ${stem}`, status: exists(f) ? 'have' : (npc === 'therapist' ? 'have' : 'placeholder'), size: '', path: npc === 'therapist' ? 'audio/heavens_waiting_room.mp3' : `music/${npc}/${stem}.ogg`, scene: `${npc} encounter${has && stem === 'intro' ? ` · arrangement JSON exists (parts: ${parts}); stems MISSING, synth plays` : ''}${!has && npc !== 'therapist' && stem === 'intro' ? ' · no arrangement yet' : ''}`, thumb: null, audio: true, ostMissing: !exists(f) && npc !== 'therapist' });
    }
  }
  const lm = S.group('Leitmotifs (code, src/shell/audio.js + content/leitmotifs.json)');
  const lmj = readJson(path.join(CH, 'content', 'leitmotifs.json'));
  const names = Object.keys(lmj).filter((k) => !k.startsWith('_'));
  lm({ name: `${names.length} leitmotifs (${names.slice(0, 12).join(', ')}${names.length > 12 ? '…' : ''})`, status: 'code', size: '', path: 'content/leitmotifs.json', scene: 'Per NPC / feeling / class', thumb: null, audio: true });

  const sfx = S.group('Sound effects (playSfx names, src/shell/audio.js)', 'Placed in script with {sfx:name}, or "sound": on hotspots and beats. The count is how many times the game files reference the name.');
  const at = read(rel('src', 'shell', 'audio.js'));
  const block = at.slice(at.indexOf('const SFX = {'), at.indexOf('export const SFX_NAMES'));
  let grp = '';
  for (const line of block.split('\n')) {
    const c = line.match(/^\s*\/\/\s*(.+)$/); if (c) { grp = c[1].replace(/\.$/, ''); continue; }
    const m = line.match(/^\s{2}(\w+):\s*\(/);
    if (m) {
      const n = countSrc(new RegExp(`(sfx:${m[1]}\\b|sound['"]?:\\s*['"]${m[1]}['"]|playSfx\\(['"]${m[1]}['"])`, 'g'));
      sfx({ name: m[1], status: 'code', size: '', path: 'SFX table', scene: `${grp} · ${n} use${n === 1 ? '' : 's'}`, thumb: null, audio: true });
    }
  }
  const ui = S.group('Other synthesised sounds and stings (exported play… functions)');
  for (const m of at.matchAll(/export (?:async )?function (play\w+)/g)) {
    const n = m[1];
    if (n === 'playSfx') continue;
    const uses = grepSrc(`${n}(`).filter((x) => x !== 'shell/audio.js');
    ui({ name: n, status: 'code', size: '', path: 'src/shell/audio.js', scene: uses.length ? `used by ${uses.slice(0, 4).join(', ')}${uses.length > 4 ? '…' : ''}` : 'internal', thumb: null, audio: true });
  }
}

// ── Build ───────────────────────────────────────────────────────────────────
await characters();
await plates();
await battleArt();
await uiArt();
await titleFonts();
await audio();

const all = sections.flatMap((s) => s.groups.flatMap((g) => g.items));
const count = (items) => ({ have: items.filter((i) => i.status === 'have').length, placeholder: items.filter((i) => i.status === 'placeholder').length, missing: items.filter((i) => i.status === 'missing').length, code: items.filter((i) => i.status === 'code').length });
const tot = count(all);

const LABEL = { have: 'HAVE', placeholder: 'PLACEHOLDER', missing: 'MISSING', code: 'CODE' };
function tile(it) {
  const frames = it.frames && it.frames !== 1 ? `<i class="fr">${esc(it.frames)}f</i>` : '';
  let pic;
  if (it.thumb) pic = `<img src="${it.thumb}" alt="">`;
  else if (it.font) pic = `<span class="fnt" style="font-family:'${esc(it.font)}',monospace">Aa</span>`;
  else if (it.audio) pic = '<span class="glyph">♪</span>';
  else if (it.video) pic = '<span class="glyph">▶</span>';
  else if (it.textOnly) pic = '<span class="glyph">T</span>';
  else pic = `<span class="x">${it.status === 'missing' ? 'MISSING' : 'CODE'}</span>`;
  return `<figure class="t ${it.status}${it.optional ? ' opt' : ''}"><div class="sq">${pic}${frames}<b class="st">${LABEL[it.status]}${it.optional ? ' · opt' : ''}</b></div><figcaption><b>${esc(it.name)}</b><small>${esc(it.size || '')}</small></figcaption></figure>`;
}
function rowOf(it) {
  return `<tr><td class="nm">${esc(it.name)}${it.optional ? ' <em>(optional)</em>' : ''}</td><td class="stc ${it.status}">${LABEL[it.status]}</td><td>${esc(it.size || '')}${it.frames && it.frames !== 1 ? ` · ${esc(it.frames)} frames` : ''}</td><td class="pa"><code>${esc(it.path)}</code></td><td>${esc(it.scene || '')}</td></tr>`;
}
const visualSections = new Set(['characters', 'plates', 'scenes', 'ui', 'title']);
let body = '';
let toc = '';
for (const s of sections) {
  const items = s.groups.flatMap((g) => g.items);
  const c = count(items);
  toc += `<tr><td><a href="#${s.id}">${esc(s.title)}</a></td><td>${items.length}</td><td class="have">${c.have}</td><td class="placeholder">${c.placeholder}</td><td class="missing">${c.missing}</td><td class="code">${c.code}</td></tr>`;
  body += `<section class="sec" id="${s.id}"><h2>${esc(s.title)}</h2>${s.blurb ? `<p class="blurb">${esc(s.blurb)}</p>` : ''}`;
  for (const g of s.groups) {
    const gc = count(g.items);
    body += `<h3>${esc(g.name)} <span class="cnt">${g.items.length} · <b class="have">${gc.have}</b> have · <b class="placeholder">${gc.placeholder}</b> placeholder · <b class="missing">${gc.missing}</b> missing${gc.code ? ` · <b class="code">${gc.code}</b> code` : ''}</span></h3>${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}`;
    const visual = g.items.filter((i) => visualSections.has(s.id) && !i.audio && !i.textOnly && !i.video && !i.font);
    const rest = g.items.filter((i) => !visual.includes(i));
    if (visual.length) body += `<div class="grid">${visual.map(tile).join('')}</div>`;
    if (visual.length) body += `<table class="meta"><thead><tr><th>Asset</th><th>Status</th><th>Size</th><th>File path</th><th>Used by</th></tr></thead><tbody>${visual.map(rowOf).join('')}</tbody></table>`;
    if (rest.length) body += `<table class="meta"><thead><tr><th>Asset</th><th>Status</th><th>Size</th><th>File path</th><th>Used by / note</th></tr></thead><tbody>${rest.map(rowOf).join('')}</tbody></table>`;
  }
  body += '</section>';
}

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Dream Xtreme: Asset Bible</title>
<style>
@page { size: Letter; margin: 0.5in 0.45in 0.6in; @bottom-center { content: "Dream Xtreme · Asset Bible · page " counter(page); font: 8pt 'Segoe UI', Arial, sans-serif; color: #777; } }
* { box-sizing: border-box; }
body { margin: 0; font: 9pt/1.35 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 30pt; margin: 0 0 4pt; letter-spacing: -0.5pt; }
h2 { font-size: 18pt; margin: 0 0 4pt; border-bottom: 3pt solid #111; padding-bottom: 3pt; }
h3 { font-size: 10pt; margin: 12pt 0 3pt; text-transform: uppercase; letter-spacing: 0.5pt; break-after: avoid; }
.cnt { font-weight: 400; text-transform: none; letter-spacing: 0; color: #555; font-size: 8.5pt; }
.sec { break-before: page; }
.cover { break-after: page; }
.blurb, .note { color: #444; margin: 0 0 5pt; font-size: 8.5pt; }
code { font: 7.5pt Consolas, monospace; background: #f1f1f1; padding: 0 2pt; word-break: break-all; }
.legend { display: flex; gap: 10pt; margin: 8pt 0 12pt; flex-wrap: wrap; }
.legend span { border: 1.5pt solid #111; padding: 2pt 8pt; font-weight: 700; font-size: 8.5pt; }
.have { color: #0a7d2c; } .placeholder { color: #a05a00; } .missing { color: #b3261e; } .code { color: #2a4fb3; }
.legend .have { border-color: #0a7d2c; } .legend .placeholder { border-color: #a05a00; border-style: dashed; } .legend .missing { border-color: #b3261e; border-style: dotted; } .legend .code { border-color: #2a4fb3; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.4pt; border-bottom: 1.5pt solid #111; padding: 2pt 4pt; }
td { padding: 2.5pt 4pt; border-bottom: 0.5pt solid #ddd; vertical-align: top; font-size: 8pt; }
tr { break-inside: avoid; }
.toc td, .toc th { font-size: 10pt; padding: 4pt 6pt; } .toc td:not(:first-child), .toc th:not(:first-child) { text-align: center; }
.toc a { color: #111; font-weight: 600; text-decoration: none; }
td.nm { font-weight: 600; width: 1.7in; } td.pa { width: 2.3in; }
.stc { font-weight: 700; font-size: 7.5pt; white-space: nowrap; }
.meta { margin: 6pt 0 10pt; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, 0.96in); gap: 6pt 5pt; margin: 4pt 0 2pt; }
.t { margin: 0; break-inside: avoid; }
.sq { position: relative; width: 0.96in; height: 0.96in; background: #000; border: 1.5pt solid #0a7d2c; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.sq img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; background: #fff; }
.t.placeholder .sq { border: 1.5pt dashed #a05a00; }
.t.placeholder .sq img { opacity: .85; }
.t.missing .sq { border: 1.5pt dotted #b3261e; background: repeating-linear-gradient(45deg, #fff 0 5px, #f6dcda 5px 10px); }
.t.code .sq { border-color: #2a4fb3; }
.t.opt .sq { opacity: .55; }
.x { color: #b3261e; font-weight: 800; font-size: 8pt; letter-spacing: 0.5pt; transform: rotate(-20deg); background: #fff; padding: 1pt 3pt; border: 1pt solid #b3261e; }
.t.code .x { color: #2a4fb3; border-color: #2a4fb3; }
.glyph, .fnt { color: #fff; font-size: 22pt; }
.st { position: absolute; left: 0; right: 0; bottom: 0; font: 700 6pt/1 'Segoe UI', Arial, sans-serif; text-align: center; padding: 1.5pt 0; background: #0a7d2c; color: #fff; letter-spacing: .3pt; }
.t.placeholder .st { background: #a05a00; } .t.missing .st { background: #b3261e; } .t.code .st { background: #2a4fb3; }
.fr { position: absolute; top: 0; right: 0; background: #111; color: #fff; font: 600 6pt/1 'Segoe UI', Arial; padding: 1.5pt 3pt; font-style: normal; }
figcaption { width: 0.96in; font-size: 6.5pt; line-height: 1.15; margin-top: 2pt; overflow-wrap: anywhere; }
figcaption b { display: block; } figcaption small { color: #666; font-size: 6pt; }
em { color: #777; font-style: normal; font-weight: 400; }
</style></head><body>
<section class="cover">
  <p style="font:600 8pt 'Segoe UI';text-transform:uppercase;letter-spacing:1pt;color:#555">Dream Xtreme · production asset bible · ${today}</p>
  <h1>Asset Bible</h1>
  <p>Every asset the game could use, in one place, for the build weekend. Generated from the game's own files by <code>npm run asset-bible</code> (scripts/build-asset-bible.mjs), so it follows the game: re-run it after any art lands.</p>
  <div class="legend"><span class="have">HAVE · final art on disk</span><span class="placeholder">PLACEHOLDER · on disk, to be replaced</span><span class="missing">MISSING · nothing on disk</span><span class="code">CODE · drawn or synthesised in code</span></div>
  <p><b>${all.length}</b> assets: <b class="have">${tot.have}</b> have · <b class="placeholder">${tot.placeholder}</b> placeholder · <b class="missing">${tot.missing}</b> missing · <b class="code">${tot.code}</b> code. Faded tiles marked "opt" are optional (a feeling the NPC never shows in a battle, or art the game does not need yet).</p>
  <table class="toc"><thead><tr><th>Section</th><th>Total</th><th>Have</th><th>Placeholder</th><th>Missing</th><th>Code</th></tr></thead><tbody>${toc}</tbody></table>
  <h3>The look, in three rules</h3>
  <p>1. White on black, 1-bit pixel art and dither; hard edges, no soft gradients, no glows. 2. The screen is 390 × 844; draw at 2× (780 × 1688) unless a row says otherwise. 3. Replace, don't rename: drop real art at the listed path. Sizes and templates: <code>docs/ASSET_SIZES.md</code>, <code>docs/ART_GUIDE.md</code>, <code>docs/CHARACTER_ART.md</code>, <code>docs/BATTLE_ART.pdf</code>.</p>
</section>
${body}
</body></html>`;

const htmlFile = rel('docs', 'ASSET_BIBLE.html');
const pdfFile = rel('docs', 'ASSET_BIBLE.pdf');
fs.writeFileSync(htmlFile, html);
const csv = ['section,group,asset,status,optional,size,frames,path,used_by'].concat(all.map((i) => [i.section, i.group, i.name, i.status, i.optional ? 'optional' : '', i.size ?? '', i.frames ?? '', i.path ?? '', i.scene ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))).join('\n');
fs.writeFileSync(rel('docs', 'ASSET_BIBLE.csv'), csv);
console.log(`docs/ASSET_BIBLE.html  ${all.length} assets: ${tot.have} have, ${tot.placeholder} placeholder, ${tot.missing} missing, ${tot.code} code`);

const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(exists);
if (!browser) console.log('No Edge or Chrome found: open the HTML and print it to PDF.');
else {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dx-pdf-'));
  const r = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000', `--user-data-dir=${profile}`, `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href], { encoding: 'utf8', timeout: 120000 });
  // Edge can return before the file is flushed
  for (let i = 0; i < 60 && !(exists(pdfFile) && fs.statSync(pdfFile).mtimeMs > Date.now() - 120000); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  fs.rmSync(profile, { recursive: true, force: true });
  if (exists(pdfFile)) console.log(`docs/ASSET_BIBLE.pdf   (${Math.round(fs.statSync(pdfFile).size / 1024)} KB)`);
  else console.log('PDF failed:', r.stderr?.slice(0, 400));
}
