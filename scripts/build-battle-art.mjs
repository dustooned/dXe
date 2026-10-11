#!/usr/bin/env node
// Builds the artists' battle-art brief: docs/BATTLE_ART.html and docs/BATTLE_ART.pdf.
//
//   npm run battle-art
//
// Everything in it is read from the game, so it can't go stale: which feelings
// each NPC actually shows in a battle (their content JSON: a node's MASK, else
// its MOOD), what the standard set is (src/engine/characters.js), and which
// pieces are already drawn (src/chapters/lake-ulysses/characters/<npc>.json,
// written by the GIF importer). Re-run it after new art lands or the script
// changes. The PDF is printed with Edge or Chrome (headless); without one you
// still get the HTML, which prints to PDF from any browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { STATE_NAMES } from '../src/engine/characters.js';
import { EMOTION_ORDER, CLASSES } from '../src/engine/loadout.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(ROOT, ...p);
const read = (p) => fs.readFileSync(p, 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const NPCS = ['deborah', 'rwanda', 'samun', 'rick'];
const NAME = (n) => n.charAt(0).toUpperCase() + n.slice(1);
const css = read(rel('src', 'style.css'));
const hex = (v) => css.match(new RegExp(`--${v}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1] ?? '#888';
const feelingColor = (f) => hex(`color-feelz-${f.toLowerCase()}`);
const accent = (n) => hex(`color-${n}`);
const REACTIONS = ['truth', 'lie', 'hit', 'warm'];

// ── What each NPC shows, and what is already drawn ─────────────────────────
function plainLine(prompt) {
  const text = String(prompt ?? '').replace(/\{\/?[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
  const quote = text.match(/"([^"]{12,})"/)?.[1] ?? text.replace(/^\([^)]*\)\s*/, '');
  return quote.length > 118 ? `${quote.slice(0, 115).replace(/\s+\S*$/, '')}…` : quote;
}

function loadNpc(npc) {
  const j = JSON.parse(read(rel('src', 'chapters', 'lake-ulysses', 'content', `${npc}.json`)));
  const mFile = rel('src', 'chapters', 'lake-ulysses', 'characters', `${npc}.json`);
  const art = fs.existsSync(mFile) ? JSON.parse(read(mFile)).art : {};
  const shown = {};
  for (const node of Object.values(j.nodes)) {
    const f = node.mask ?? node.mood;
    if (!f) continue;
    const s = (shown[f] ??= { count: 0, line: null, over: new Set() });
    s.count++;
    if (!s.line && /"[^"]{12,}"/.test(String(node.prompt ?? '').replace(/\{\/?[^}]*\}/g, ''))) s.line = plainLine(node.prompt);
    if (node.mask && node.mood && node.mood !== node.mask) s.over.add(node.mood);
  }
  for (const s of Object.values(shown)) s.line ??= '';
  const feelings = Object.keys(shown).sort((a, b) => shown[b].count - shown[a].count || EMOTION_ORDER.indexOf(a) - EMOTION_ORDER.indexOf(b));
  return { npc, j, art, shown, feelings, cls: j.npcClass, beats: Object.keys(j.nodes).length };
}

// Waves: 1 gets them on screen, 2 makes the talk feel alive, 3 is the full range.
function pieces(d) {
  const N = NAME(d.npc);
  const f = (kind, feeling) => `Profile_${N}_${kind}_${NAME(feeling.toLowerCase())}.gif`;
  const list = [
    { wave: 1, state: 'idle', file: `Profile_${N}_Idle.gif`, what: 'The resting face. <b>Mouth shut</b>, eyes open, held still. Can be a short loop (a glance, a blink) if the mouth stays shut in every frame.', frames: '1, or a short loop' },
    { wave: 1, state: 'talk', file: `Profile_${N}_Talk.gif`, what: 'Mouth moving, <b>only while their quoted words are being typed</b>. Loops. Frame 0 must be the idle picture, so the mouth starts shut.', frames: '3, looping' },
    ...REACTIONS.map((r) => ({
      wave: 2, state: `react_${r}`, file: `Profile_${N}_React_${NAME(r)}.gif`, frames: '3 to 4, once',
      what: { truth: 'A <b>true</b> answer lands. Plays once, just before they speak. Mouth shut.', lie: 'A <b>comforting lie</b> lands. Plays once, just before they speak.', hit: 'A <b>big swing</b>: your words hit hard. Plays once, just before they speak.', warm: 'They <b>turn toward you</b> (you answered what they were reaching for).' }[r],
    })),
  ];
  d.feelings.forEach((fe, i) => {
    const wave = i < 2 ? 2 : 3;
    list.push({ wave, state: `talk_${fe.toLowerCase()}`, feeling: fe, file: f('Talk', fe), frames: '3, looping', what: `Speaking in <b>${fe}</b>. Frame 0 is the idle picture.` });
    list.push({ wave, state: `wait_${fe.toLowerCase()}`, feeling: fe, file: f('Wait', fe), frames: '1 to 4, once', what: `Waiting on you, feeling <b>${fe}</b>. Plays once, holds the last frame. Mouth shut.` });
  });
  return list.map((p) => ({ ...p, done: !!d.art[p.state] }));
}

const LATER = (npc) => {
  const N = NAME(npc);
  return [
    { state: 'react_cold', file: `Profile_${N}_React_Cold.gif`, what: 'They <b>close up</b> (you missed what they were reaching for). 3 to 4 frames, once.' },
    { state: 'connect', file: `Profile_${N}_Connect.gif`, what: 'The stay-in-touch moment. One picture, or a short once-through.' },
    { state: 'pushaway', file: `Profile_${N}_Pushaway.gif`, what: 'You are pushed away at the end. One picture, or a short once-through.' },
    { state: 'trauma_1…5', file: `Profile_${N}_Trauma_1.gif to _5.gif`, what: 'Five images, one per beat of their story, shown in silence. <b>Proposed size 240 × 240</b> (tell us if you would rather match 192).', n: 5 },
  ];
};

// ── Pictures: the art that exists, enlarged with hard pixels ──────────────
const uri = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
async function big(file, scale = 3) {
  const buf = await sharp(file).resize(192 * scale, 192 * scale, { kernel: 'nearest' }).png({ palette: true, colours: 4, compressionLevel: 9 }).toBuffer();
  return uri(buf);
}
async function framesOf(npc, state, art) {
  const piece = art[state];
  if (!piece) return [];
  const dir = rel('public', 'assets', 'lake-ulysses', 'characters', npc);
  if (piece.frames === 1) return [await big(path.join(dir, `${state}.png`))];
  return Promise.all(Array.from({ length: piece.frames }, (_, i) => big(path.join(dir, state, `${state}_${String(i).padStart(4, '0')}.png`))));
}

// ── HTML ───────────────────────────────────────────────────────────────────
const chip = (f) => `<span class="chip" style="--c:${feelingColor(f)}"><i></i>${esc(f)}</span>`;
const file = (s) => `<code>${esc(s)}</code>`;
const tick = (done) => (done ? '<span class="ok">✔ in</span>' : '<span class="todo">to draw</span>');

function strip(frames, label, size = 1.0) {
  if (!frames.length) return '';
  return `<figure class="strip"><div class="frames">${frames.map((u, i) => `<div><img src="${u}" style="width:${size}in"><small>${frames.length > 1 ? `frame ${i}` : 'still'}</small></div>`).join('')}</div><figcaption>${esc(label)}</figcaption></figure>`;
}

async function npcPage(d, n) {
  const N = NAME(d.npc);
  const ps = pieces(d);
  const total = ps.length;
  const done = ps.filter((p) => p.done).length;
  const cls = CLASSES[d.cls];
  const idleFrames = await framesOf(d.npc, 'idle', d.art);
  const talkFrames = await framesOf(d.npc, 'talk', d.art);
  const extras = Object.keys(d.art).filter((k) => !STATE_NAMES.includes(k));
  const extraFrames = (await Promise.all(extras.map((k) => framesOf(d.npc, k, d.art)))).flat();
  const rows = [];
  let lastWave = 0;
  const waveName = { 1: 'Wave 1: get them on screen', 2: 'Wave 2: make the conversation feel alive', 3: 'Wave 3: their full range' };
  const feelingRows = new Map();
  for (const p of ps) {
    if (p.wave !== lastWave) { rows.push(`<tr class="wave"><td colspan="5">${waveName[p.wave]}</td></tr>`); lastWave = p.wave; }
    if (p.feeling) {
      // talk + wait of one feeling share a heading row
      if (!feelingRows.has(p.feeling)) {
        const s = d.shown[p.feeling];
        feelingRows.set(p.feeling, true);
        const mask = s.over.size ? ` <em>A mask: the face wears ${esc(p.feeling)} over ${[...s.over].map(esc).join(', ')}.</em>` : '';
        rows.push(`<tr class="feeling"><td colspan="5">${chip(p.feeling)}<span class="uses">in ${s.count} of their ${d.beats} beats.${s.line ? ` Like: <q>${esc(s.line)}</q>` : ''}${mask}</span></td></tr>`);
      }
    }
    rows.push(`<tr><td class="w">${p.wave}</td><td>${file(p.file)}</td><td>${p.what}</td><td class="nowrap">${p.frames}</td><td>${tick(p.done)}</td></tr>`);
  }
  const skipped = EMOTION_ORDER.filter((f) => !d.shown[f]);
  const later = LATER(d.npc).map((p) => `<tr><td>${file(p.file)}</td><td>${p.what}</td></tr>`).join('');
  return `
<section class="npc" style="--accent:${accent(d.npc)}">
  <header class="npc-head">
    <div>
      <p class="kicker">${n} · ${esc(cls?.label ?? d.cls)} · ${d.beats} battle beats</p>
      <h2>${esc(N)}</h2>
      <p class="classline">${esc(cls?.description ?? '')}</p>
      <p class="score"><b>${done}</b> of <b>${total}</b> pieces drawn</p>
    </div>
    ${idleFrames[0] ? `<img class="face" src="${idleFrames[0]}" alt="">` : '<div class="face blank">no art yet</div>'}
  </header>
  <div class="strips">
    ${strip(idleFrames, 'idle (in the game now)', idleFrames.length > 4 ? 0.62 : 0.85)}
    ${strip(talkFrames, 'talk loop (in the game now)', 0.85)}
    ${strip(extraFrames, 'extras received, not a state yet', 0.62)}
  </div>
  <h3>What to draw, in order</h3>
  <table class="pieces">
    <thead><tr><th>Wave</th><th>File name</th><th>What it is</th><th>Frames</th><th>Status</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <div class="two">
    <div>
      <h3>Later: not in the game yet</h3>
      <p class="note">Don't start these first. We hook them up as the art arrives.</p>
      <table class="later">${later}</table>
    </div>
    <div>
      <h3>Skip: ${esc(N)} never shows these</h3>
      <p class="note">No battle beat uses them, so no talk or wait pieces are needed.</p>
      <p class="skips">${skipped.map(chip).join(' ')}</p>
    </div>
  </div>
</section>`;
}

function matrix(data) {
  const cell = (d, state) => {
    if (d.art[state]) return '<td class="m-ok">✔</td>';
    return '<td class="m-todo">○</td>';
  };
  const head = `<tr><th>Piece</th>${data.map((d) => `<th style="border-top:4px solid ${accent(d.npc)}">${NAME(d.npc)}</th>`).join('')}</tr>`;
  const simple = ['idle', 'talk', ...REACTIONS.map((r) => `react_${r}`)].map((s) => `<tr><td class="lab">${file(s)}</td>${data.map((d) => cell(d, s)).join('')}</tr>`);
  const feelingRows = EMOTION_ORDER.map((f) => `<tr><td class="lab">${chip(f)} <small>talk + wait</small></td>${data.map((d) => {
    if (!d.shown[f]) return '<td class="m-skip">skip</td>';
    const a = d.art[`talk_${f.toLowerCase()}`] ? 1 : 0;
    const b = d.art[`wait_${f.toLowerCase()}`] ? 1 : 0;
    return a + b === 2 ? '<td class="m-ok">✔</td>' : a + b === 1 ? '<td class="m-half">½</td>' : `<td class="m-todo">○ <small>${d.shown[f].count}</small></td>`;
  }).join('')}</tr>`);
  const later = ['react_cold', 'connect', 'pushaway'].map((s) => `<tr class="later-row"><td class="lab">${file(s)} <small>later</small></td>${data.map((d) => (d.art[s] ? '<td class="m-ok">✔</td>' : '<td class="m-later">later</td>')).join('')}</tr>`);
  later.push(`<tr class="later-row"><td class="lab">${file('trauma_1…5')} <small>later</small></td>${data.map((d) => `<td class="m-later">${[1, 2, 3, 4, 5].filter((i) => d.art[`trauma_${i}`]).length || 'later'}</td>`).join('')}</tr>`);
  return `<table class="matrix"><thead>${head}</thead><tbody>${simple.join('')}${feelingRows.join('')}${later.join('')}</tbody></table>
  <p class="note">✔ drawn · ○ to draw (the small number is how many battle beats use that feeling) · ½ one of the two · skip: never shown, don't draw · later: not in the game yet.</p>`;
}

async function build() {
  const data = NPCS.map(loadNpc);
  const allPieces = data.map((d) => ({ d, ps: pieces(d) }));
  const need = allPieces.reduce((a, x) => a + x.ps.length, 0);
  const have = allPieces.reduce((a, x) => a + x.ps.filter((p) => p.done).length, 0);
  const sizeDemo = data.find((d) => d.art.idle);
  const demoUri = sizeDemo ? (await framesOf(sizeDemo.npc, 'idle', sizeDemo.art))[0] : null;
  const small = sizeDemo ? uri(fs.readFileSync(path.join(rel('public', 'assets', 'lake-ulysses', 'characters', sizeDemo.npc), sizeDemo.art.idle.frames === 1 ? 'idle.png' : 'idle/idle_0000.png'))) : null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const wave = (d, w) => { const ps = pieces(d).filter((p) => p.wave === w); return `${ps.filter((p) => p.done).length} / ${ps.length}`; };
  const progress = `<table class="progress"><thead><tr><th>NPC</th><th>Wave 1<br><small>on screen</small></th><th>Wave 2<br><small>feels alive</small></th><th>Wave 3<br><small>full range</small></th><th>Total</th></tr></thead><tbody>${data.map((d) => { const ps = pieces(d); return `<tr><td class="who" style="border-left:5pt solid ${accent(d.npc)}"><b>${NAME(d.npc)}</b> <small>${esc(d.cls)}</small></td><td>${wave(d, 1)}</td><td>${wave(d, 2)}</td><td>${wave(d, 3)}</td><td><b>${ps.filter((p) => p.done).length} / ${ps.length}</b></td></tr>`; }).join('')}</tbody></table>`;
  const pages = [];
  for (let i = 0; i < data.length; i++) pages.push(await npcPage(data[i], `NPC ${i + 1} of ${data.length}`));

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Dream Xtreme: Battle Art Brief</title>
<style>
@page { size: Letter; margin: 0.55in 0.6in 0.7in; @bottom-center { content: "Dream Xtreme · Battle Art Brief · page " counter(page); font: 8pt 'Segoe UI', Arial, sans-serif; color: #777; } }
* { box-sizing: border-box; }
body { margin: 0; font: 10pt/1.4 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 30pt; line-height: 1.05; margin: 0 0 4pt; letter-spacing: -0.5pt; }
h2 { font-size: 24pt; margin: 0; line-height: 1; }
h3 { font-size: 11.5pt; margin: 14pt 0 4pt; text-transform: uppercase; letter-spacing: 0.6pt; break-after: avoid; }
p { margin: 0 0 6pt; }
code { font: 8pt Consolas, 'Courier New', monospace; background: #f1f1f1; padding: 1pt 3pt; border-radius: 2pt; white-space: nowrap; }
q { font-style: italic; quotes: '\\201C' '\\201D'; }
.kicker { font: 600 8pt/1 'Segoe UI', Arial, sans-serif; text-transform: uppercase; letter-spacing: 1pt; color: #555; margin-bottom: 4pt; }
.note { color: #555; font-size: 9pt; }
.page { break-after: page; }
.cover .sub { font-size: 13pt; color: #333; margin-bottom: 14pt; }
.rules { border: 2pt solid #111; padding: 10pt 14pt; margin: 10pt 0; }
.rules ol { margin: 4pt 0 0; padding-left: 16pt; }
.rules li { margin: 0 0 4pt; }
.size { display: flex; gap: 22pt; align-items: flex-end; margin: 10pt 0 4pt; }
.size figure { margin: 0; }
.size img { display: block; border: 1pt solid #111; image-rendering: pixelated; }
.size figcaption { font-size: 8.5pt; color: #444; margin-top: 3pt; max-width: 2.3in; }
.flow { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8pt; margin: 8pt 0 10pt; }
.step { border: 1pt solid #111; padding: 7pt 9pt; break-inside: avoid; }
.step b.n { display: inline-block; background: #111; color: #fff; width: 15pt; height: 15pt; line-height: 15pt; text-align: center; border-radius: 50%; margin-right: 5pt; font-size: 9pt; }
.step.later { border-style: dashed; color: #444; }
.step .states { margin-top: 3pt; }
.rule2 { background: #f4f4f4; padding: 8pt 12pt; margin: 8pt 0; }
.rule2 li { margin-bottom: 3pt; }
.chip { display: inline-flex; align-items: center; gap: 4pt; font-weight: 600; font-size: 9pt; border: 1pt solid #111; border-radius: 10pt; padding: 0 7pt 0 4pt; background: #fff; white-space: nowrap; }
.chip i { width: 8pt; height: 8pt; border-radius: 50%; background: var(--c); border: 0.75pt solid #111; display: inline-block; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5pt; border-bottom: 2pt solid #111; padding: 3pt 5pt; }
td { padding: 4pt 5pt; border-bottom: 0.5pt solid #ccc; vertical-align: top; font-size: 9pt; }
tr { break-inside: avoid; }
.nowrap { white-space: nowrap; }
.ok { color: #0a7d2c; font-weight: 700; white-space: nowrap; }
.todo { color: #8a5a00; font-weight: 600; white-space: nowrap; }
.matrix th, .matrix td { text-align: center; }
.matrix td.lab, .matrix th:first-child { text-align: left; }
.matrix td { font-size: 9.5pt; padding: 3.5pt 5pt; }
.m-ok { color: #0a7d2c; font-weight: 700; }
.m-todo { color: #111; }
.m-half { color: #8a5a00; font-weight: 700; }
.m-skip { color: #aaa; font-size: 8pt !important; text-transform: uppercase; letter-spacing: 0.5pt; }
.m-later { color: #888; font-size: 8pt !important; text-transform: uppercase; letter-spacing: 0.5pt; }
.matrix small, .pieces small { color: #777; font-size: 7.5pt; }
.later-row td.lab { color: #555; }
.npc { break-before: page; }
.npc-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 5pt solid var(--accent); padding-bottom: 8pt; margin-bottom: 8pt; }
.npc-head .face { width: 1.45in; height: 1.45in; border: 1.5pt solid #111; image-rendering: pixelated; }
.npc-head .face.blank { display: flex; align-items: center; justify-content: center; text-align: center; color: #888; font-size: 9pt; background: repeating-linear-gradient(45deg, #fff 0 6px, #f1f1f1 6px 12px); }
.classline { color: #333; margin: 3pt 0 6pt; }
.score { font-size: 11pt; margin: 0; }
.strip { margin: 0; break-inside: avoid; }
.strip .frames { display: flex; gap: 5pt; flex-wrap: wrap; }
.strip .frames div { text-align: center; }
.strip img { display: block; border: 0.75pt solid #999; image-rendering: pixelated; }
.strip small { font-size: 7pt; color: #777; }
.strip figcaption { font-size: 8pt; color: #555; margin-top: 2pt; }
tr.wave td { background: #111; color: #fff; font-weight: 700; font-size: 8.5pt; letter-spacing: 0.6pt; text-transform: uppercase; padding: 3pt 6pt; }
tr.feeling td { background: #f4f4f4; padding: 5pt 6pt 3pt; border-bottom: none; }
tr.feeling .uses { margin-left: 8pt; font-size: 8.5pt; color: #333; }
tr.feeling em { color: #7a2a00; font-style: normal; font-weight: 600; }
td.w { font-weight: 700; text-align: center; width: 0.4in; }
.pieces td:nth-child(2) { width: 2.35in; }
.pieces td:nth-child(4) { width: 1.05in; }
.pieces td:nth-child(5) { width: 0.7in; }
.two { display: grid; grid-template-columns: 1.7fr 1fr; gap: 16pt; margin-top: 4pt; }
.strips { display: flex; gap: 14pt; align-items: flex-start; margin: 4pt 0 2pt; }
.progress th { text-align: center; } .progress th:first-child { text-align: left; }
.progress td { text-align: center; font-size: 10pt; padding: 4pt 6pt; } .progress td.who { text-align: left; padding-left: 8pt; }
.progress small { color: #777; font-weight: 400; }
.later td { font-size: 8.5pt; }
.later td:first-child { width: 2.45in; }
.skips { display: flex; flex-wrap: wrap; gap: 4pt; }
.send td:first-child { white-space: nowrap; }
</style></head><body>

<section class="cover page">
  <p class="kicker">Dream Xtreme · Chapter 1 · for the artists · ${today}</p>
  <h1>Battle Art Brief</h1>
  <p class="sub">What to draw for each NPC in a battle, and exactly when it shows up.</p>

  <div class="rules">
    <b>The short version</b>
    <ol>
      <li>Draw each NPC at <b>192 × 192 pixels</b>: black pixel art on a <b>white background</b>, like the Therapist, Deborah and Samun files you sent.</li>
      <li>Each NPC is a <b>checklist of poses</b>, with their own section. Work in waves: wave 1 puts them on screen, wave 2 makes the talk feel alive, wave 3 is their full range.</li>
      <li><b>Mouths are shut</b> in every pose except the talk loops. They only move while the NPC's quoted words are being said.</li>
      <li>Send GIFs named <code>Profile_&lt;Npc&gt;_&lt;State&gt;.gif</code> (the exact names are on each NPC's page).</li>
    </ol>
  </div>

  <p><b>${have} of ${need}</b> priority pieces are drawn across the four NPCs. The numbers in this brief come straight from the game's script: if a feeling never appears in an NPC's battle, you won't be asked to draw it.</p>

  ${demoUri ? `<h3>How big it really is</h3>
  <div class="size">
    <figure><img src="${demoUri}" style="width:1.5in;height:1.5in"><figcaption>What you draw: 192 × 192 pixels (shown here at 1.5 in).</figcaption></figure>
    <figure><img src="${small}" style="width:0.9in;height:0.9in;image-rendering:auto"><figcaption>What the player sees: about 96 × 96 on a phone, with a thin border. Bold shapes read best. The mouth and eyes carry the feeling.</figcaption></figure>
  </div>` : ''}

  <h3>Where we are</h3>
  ${progress}
  <p class="note" style="margin-top:10pt">Next: how a battle plays and the rules, then the whole checklist on one page, then one section per NPC with the exact file names, and last how to send the art.</p>
</section>

<section class="page flowpage">
  <p class="kicker">How it plays</p>
  <h1 style="font-size:22pt">A battle, beat by beat</h1>
  <p>A battle is a conversation. The NPC says something, you pick a feeling and answer, they react, then speak again. Their face changes with each step:</p>
  <div class="flow">
    <div class="step"><b class="n">1</b><b>They are quiet</b><br>The resting face, held still. Nothing moves.<div class="states"><code>idle</code></div></div>
    <div class="step"><b class="n">2</b><b>They speak</b><br>The mouth loops while their <i>quoted</i> words type out, and closes the moment the quote ends.<div class="states"><code>talk</code> or <code>talk_&lt;feeling&gt;</code></div></div>
    <div class="step"><b class="n">3</b><b>Your turn</b><br>They wait for you, feeling what they feel: a short anticipation that plays once and holds its last frame.<div class="states"><code>wait_&lt;feeling&gt;</code></div></div>
    <div class="step"><b class="n">4</b><b>You answer</b><br>A moment before they speak again, they take your words: a one-time reaction, then back to rest.<div class="states"><code>react_truth</code> <code>react_lie</code> <code>react_hit</code> <code>react_warm</code></div></div>
    <div class="step later"><b class="n">5</b><b>They close up (later)</b><br>When you miss what they were reaching for.<div class="states"><code>react_cold</code></div></div>
    <div class="step later"><b class="n">6</b><b>The ending (later)</b><br>You stay in touch, or you are pushed away. During their story, five images are shown in silence.<div class="states"><code>connect</code> <code>pushaway</code> <code>trauma_1…5</code></div></div>
  </div>

  <h3>Rules that matter</h3>
  <ul class="rule2">
    <li><b>The mouth only moves in talk poses.</b> Idle, wait and react frames all have a shut mouth. Narration, stage directions and pauses never move it.</li>
    <li><b>The talk loop starts on the idle picture.</b> Frame 0 of every talk loop is the idle face, so when they start speaking the mouth begins exactly where it was resting.</li>
    <li><b>Every frame gets its full time.</b> 100 ms a frame by default (10 per second). If you export a GIF with your own frame delays, the game keeps them exactly.</li>
    <li><b>Wait and react play once</b> and hold their last frame. A single still is fine for any of them; the game just holds it.</li>
    <li><b>Anything not drawn yet falls back</b> to something that is: a missing feeling pose uses the plain talk or idle. So partial sets always work, and you can send in any order.</li>
    <li><b>Living idle (optional).</b> The idle can be a short loop (a glance, a blink). It rests on frame 0 and plays now and then, so the screen stays calm. Samun's placeholder works this way.</li>
    <li><b>Wearing a mask.</b> Some of Samun's and Rick's lines show a feeling on their face that isn't what they feel underneath. You draw the face they show.</li>
  </ul>

  <h3>The eight feelings</h3>
  <p>${EMOTION_ORDER.map(chip).join(' ')}</p>
  <p class="note">The colors are the game's own feeling colors, for orientation only. The art stays black and white.</p>
</section>

<section class="page checklist">
  <p class="kicker">At a glance</p>
  <h1 style="font-size:22pt">The whole checklist</h1>
  ${matrix(data)}
</section>

${pages.join('\n')}

<section class="page-end" style="break-before:page">
  <p class="kicker">Sending it</p>
  <h1 style="font-size:22pt">Sending the art</h1>
  <table class="send">
    <tr><td><b>Format</b></td><td>GIF. One frame is a still, several frames are an animation. 192 × 192 pixels (a whole multiple like 1920 × 1920 is also fine if you draw big; we check it shrinks cleanly).</td></tr>
    <tr><td><b>Look</b></td><td>Black pixel art on white, no antialiasing, no glow or blur. (The existing files also use one near-black ink for dithering, which is fine.)</td></tr>
    <tr><td><b>Names</b></td><td><code>Profile_&lt;Npc&gt;_&lt;State&gt;.gif</code> with the NPC and state capitalised: <code>Profile_Deborah_Talk.gif</code>, <code>Profile_Samun_Wait_Anger.gif</code>, <code>Profile_Rick_React_Hit.gif</code>. The exact names for every piece are on the NPC pages.</td></tr>
    <tr><td><b>Timing</b></td><td>100 ms a frame unless you choose otherwise. Loops for talk, one-shots for wait and react: the game decides, you just draw the frames in order.</td></tr>
    <tr><td><b>Where</b></td><td>The shared Drive: <code>Chapter 1 / NPCs / &lt;Npc&gt;</code>. Drop new files in the NPC's folder (make it if it is not there yet); the same name again means "replace".</td></tr>
    <tr><td><b>Odd names</b></td><td>Don't worry about them. If a file is named differently (like <code>Profile_Deborah01.gif</code>), we map it by hand. Just tell us what it is.</td></tr>
  </table>
  <h3>Open questions for you</h3>
  <ul class="rule2">
    <li>Trauma / confession images: <b>240 × 240</b> (proposed, shown bigger) or match the 192 faces?</li>
    <li>The placeholder pieces we have (Samun's glance loop, Deborah's squint and open-mouth faces): is any of them meant for a specific moment? For example, Deborah's open mouth could be the gasp when a hit lands.</li>
  </ul>
  <p class="note">This brief is generated from the game (<code>npm run battle-art</code>), so it updates when the script or the art changes. Questions? Ask whoever sent you this brief.</p>
</section>
</body></html>`;
  return { html, need, have };
}

function findBrowser() {
  const c = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return c.find((p) => fs.existsSync(p));
}

const { html, need, have } = await build();
const htmlFile = rel('docs', 'BATTLE_ART.html');
const pdfFile = rel('docs', 'BATTLE_ART.pdf');
fs.writeFileSync(htmlFile, html);
console.log(`docs/BATTLE_ART.html  (${have} of ${need} priority pieces drawn)`);

const browser = findBrowser();
if (!browser) {
  console.log('No Edge or Chrome found: open the HTML and print it to PDF.');
} else {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dx-pdf-'));
  const r = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href], { encoding: 'utf8', timeout: 90000 });
  fs.rmSync(profile, { recursive: true, force: true });
  if (fs.existsSync(pdfFile)) console.log(`docs/BATTLE_ART.pdf   (${Math.round(fs.statSync(pdfFile).size / 1024)} KB)`);
  else console.log('PDF failed:', r.stderr?.slice(0, 400));
}
