// The sound player in the debug menu (Settings -> DEBUG -> SOUND PLAYER).
// Every track the game has: baked arrangements (play a battle, push the
// emotional numbers, tune the voices and the tempo ladder), leitmotifs, the
// audio files already in memory, and every audio file in the build.
//
// While it is open the game is held: timers paused, the scene's music off
// (it stays off until the scene changes). Tuning saves per arrangement
// (shell/soundTuning.js) and applies in the game too; COPY JSON prints it
// so it can be made the default in code.
import * as audio from '../shell/audio.js';
import * as encounterMusic from '../shell/encounterMusic.js';
import { createBattleMusic } from '../shell/battleMusic.js';
import { getTuning, resetTuning, saveTuning } from '../shell/soundTuning.js';
import { setPaused } from '../shell/pauseBus.js';
import { DEFAULT_LEVEL } from '../shell/arrangement.js';
import { DRUM_MAP, VOICE_SETS } from '../shell/arrangementVoices.js';
import { DEFAULT_TEMPO_CONFIG } from '../engine/tempoDirector.js';

/* global __AUDIO_FILES__ */
const PIECES = ['kick', 'snare', 'click', 'hat', 'openHat', 'none'];
const QUANT = ['now', 'beat', 'bar', 'pattern'];

const STYLE = `
.snd { position: absolute; inset: 0; z-index: 950; background: #000; overflow-y: auto; padding: calc(12 * var(--px)); display: flex; flex-direction: column; gap: calc(8 * var(--px)); font-size: calc(7 * var(--fs)); line-height: 1.6; }
.snd h2 { margin: 0; font-size: calc(10 * var(--fs)); }
.snd h3 { margin: calc(6 * var(--px)) 0 0; font-size: calc(7 * var(--fs)); opacity: .6; letter-spacing: .12em; }
.snd small { opacity: .6; }
.snd .row { display: flex; gap: calc(5 * var(--px)); flex-wrap: wrap; align-items: center; }
.snd button, .snd select, .snd input { font: inherit; color: #fff; background: #000; border: 2px solid #fff; padding: calc(5 * var(--px)); }
.snd button { cursor: pointer; text-align: left; }
.snd button:active, .snd button.on { background: #fff; color: #000; }
.snd button.mem::before { content: '● '; }
.snd input[type=number] { width: calc(54 * var(--px)); }
.snd input[type=range] { padding: 0; width: calc(90 * var(--px)); }
.snd .grid { display: grid; grid-template-columns: auto 1fr; gap: 2px calc(10 * var(--px)); border: 2px solid #444; padding: calc(7 * var(--px)); }
.snd .bar { height: calc(7 * var(--px)); background: #222; position: relative; align-self: center; }
.snd .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: #fff; }
.snd .big { font-size: calc(16 * var(--fs)); }
.snd .detail { border-top: 2px solid #444; padding-top: calc(8 * var(--px)); display: flex; flex-direction: column; gap: calc(6 * var(--px)); }
.snd .name { width: calc(92 * var(--px)); }
`;

const fmt = (url) => url.split('/').slice(-2).join('/');

export function mountSoundLab(host, { onClose } = {}) {
  audio.silenceGame();
  encounterMusic.end({ fade: 0.1 });
  setPaused(true);

  const style = document.createElement('style');
  style.textContent = STYLE;
  const root = document.createElement('div');
  root.className = 'snd';
  root.append(style);
  host.appendChild(root);

  let teardownDetail = () => {};

  function close() {
    teardownDetail();
    root.remove();
    setPaused(false);
    onClose?.();
  }

  function renderList() {
    const memory = new Set(audio.loadedTracks().map((t) => t.url));
    const group = (title, items) => `<h3>${title}</h3><div class="row">${items.join('')}</div>`;
    const btn = (kind, id, label, mem) => `<button data-track="${kind}:${id}" class="${mem ? 'mem' : ''}">${label}</button>`;
    root.innerHTML = '';
    root.append(style);
    const head = document.createElement('div');
    head.innerHTML = `
      <div class="row"><h2>SOUND PLAYER</h2><button data-close>CLOSE</button></div>
      <small>The game is held while this is open and its music stays off until the scene changes. ● = in memory.</small>
      ${group('ARRANGEMENTS', encounterMusic.arrangements.map((a) => btn('arr', a.id, `${a.id} · ${a.sections.length} sections`, true)))}
      ${group('LEITMOTIFS', audio.leitmotifKeys().map((k) => btn('lm', k, k, true)))}
      ${group('AUDIO IN MEMORY', audio.loadedTracks().map((t) => btn('file', t.url, `${fmt(t.url)} ${t.seconds.toFixed(1)}s`, true)))}
      ${group('ALL AUDIO FILES', __AUDIO_FILES__.map((u) => btn('file', u, fmt(u), memory.has(u))))}
    `;
    root.append(head);
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.dataset.detail = '';
    root.append(detail);
  }

  function select(kind, id) {
    teardownDetail();
    root.querySelectorAll('[data-track]').forEach((b) => b.classList.toggle('on', b.dataset.track === `${kind}:${id}`));
    const detail = root.querySelector('[data-detail]');
    detail.innerHTML = '';
    if (kind === 'arr') teardownDetail = arrangementView(detail, encounterMusic.arrangements.find((a) => a.id === id));
    else if (kind === 'lm') teardownDetail = leitmotifView(detail, id);
    else teardownDetail = fileView(detail, id);
    detail.scrollIntoView?.({ block: 'nearest' });
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { close(); return; }
    const t = e.target.closest('[data-track]');
    if (t) { const [kind, ...rest] = t.dataset.track.split(':'); select(kind, rest.join(':')); }
  });

  renderList();
  return close;
}

// ── A leitmotif: play it, lean the mood ─────────────────────────────────────
function leitmotifView(box, key) {
  box.innerHTML = `
    <div class="row"><b>${key}</b> <button data-a="play">PLAY</button><button data-a="stop">STOP</button></div>
    <div class="row"><small>mood</small><button data-a="dn">−</button><button data-a="up">+</button><b data-out="mood">0</b>
      <small>bends the phrase and the chord, like a conversation moving</small></div>`;
  const show = () => { box.querySelector('[data-out=mood]').textContent = String(audio.getLeitmotifMood()); };
  const onClick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'play') audio.startLeitmotif(key);
    else if (a === 'stop') audio.stopLeitmotif();
    else if (a === 'up') audio.nudgeLeitmotifMood(1);
    else if (a === 'dn') audio.nudgeLeitmotifMood(-1);
    show();
  };
  box.addEventListener('click', onClick);
  return () => { box.removeEventListener('click', onClick); audio.stopLeitmotif(); };
}

// ── An audio file ───────────────────────────────────────────────────────────
function fileView(box, url) {
  box.innerHTML = `
    <div class="row"><b>${url}</b></div>
    <div class="row"><button data-a="play">PLAY</button><button data-a="loop">PLAY LOOPED</button><button data-a="stop">STOP</button>
      <small data-out="info">not played yet</small></div>`;
  let playing = null;
  const stop = () => { playing?.stop(); playing = null; };
  const onClick = async (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (!a) return;
    stop();
    if (a === 'stop') return;
    const p = await audio.previewFile(url, { loop: a === 'loop' });
    playing = p;
    box.querySelector('[data-out=info]').textContent = `${p.seconds.toFixed(1)} s · now in memory`;
  };
  box.addEventListener('click', onClick);
  return () => { box.removeEventListener('click', onClick); stop(); };
}

// ── An arrangement: battle controls, mix, tuning ────────────────────────────
function arrangementView(box, data) {
  const music = createBattleMusic(data);
  const { director, player } = music;
  const cfg = director.config;
  const voice = player.config();
  const drumKeys = [...new Set(data.sections.flatMap((s) => data.parts.filter((p) => p.kind === 'drums').flatMap((p) => (s.notes[p.id] ?? []).map((n) => n[2]))))].sort((a, b) => a - b);
  const drumPart = data.parts.find((p) => p.kind === 'drums');
  const saved = getTuning(data.id);
  // The tuning being edited: starts from what is saved, grows as you change things.
  const tuning = { level: saved.level, voices: { ...(saved.voices ?? {}) }, drums: { ...(saved.drums ?? {}) }, tempo: { ...(saved.tempo ?? {}) } };
  const sectionOptions = (sel) => player.sectionIds().map((s) => `<option ${s === sel ? 'selected' : ''}>${s}</option>`).join('');
  const sel = (opts, cur) => opts.map((o) => `<option ${o === cur ? 'selected' : ''}>${o}</option>`).join('');

  box.innerHTML = `
    <div class="row"><b>${data.id}</b><small>${data.source} · ${data.sections.length} sections · key ${data.tonic ?? '?'}</small></div>
    <div class="row"><button data-act="start">START BATTLE</button><button data-act="end">END</button>
      <label>start BPM <input type="number" data-in="bpm" placeholder="${cfg.defaultBpm}" min="40" max="200"></label></div>
    <div class="grid">
      <span>BPM</span><span class="big" data-out="bpm">–</span>
      <span>target</span><span data-out="target">–</span>
      <span>state</span><span data-out="state">–</span>
      <span>section</span><span data-out="section">–</span>
      <span>position</span><span data-out="pos">–</span>
      <span>tension</span><span class="bar"><i data-bar="tension"></i></span>
      <span>agitation</span><span class="bar"><i data-bar="agitation"></i></span>
      <span>answers</span><span data-out="answers">0</span>
      <span>connection</span><span class="bar"><i data-bar="connection"></i></span>
      <span>level</span><span class="bar"><i data-bar="level"></i></span>
      <span>voices</span><span data-out="voices">–</span>
      <span>parts</span><span data-out="parts">–</span>
    </div>
    <h3>EVENTS</h3>
    <div class="row">
      <button data-ev="tensionIncreased">tension +</button><button data-ev="opponentAgitated">agitated +</button>
      <button data-ev="connectionSucceeded">connection +</button><button data-ev="connectionFailed">conn. failed</button>
      <button data-ev="opponentCalmed">opp. calmed</button>
      <button data-ev="answerGiven">ANSWER given</button></div>
    <div class="row"><button data-auto="up">AUTO: ESCALATE</button><button data-auto="down">AUTO: CALM</button><small>one event / 1.2 s</small></div>
    <div class="row"><small>section</small><select data-in="section">${sectionOptions(player.sectionIds()[0])}</select><button data-act="goSection">QUEUE</button></div>
    <h3>MIX</h3>
    ${player.hasSecret() ? '<div class="row"><button data-act="secret">SECRET TRACK</button><small>fades in near a full connection (closeness ≥ ' + cfg.secretAt + ')</small></div>' : '<small>No secret track yet: name an FL channel "Secret…" and rebake.</small>'}
    ${data.parts.map((p) => `<div class="row" data-part="${p.id}"><span class="name">${p.secret ? '★ ' : ''}${p.label}</span>
      <input type="range" min="0" max="1.5" step="0.05" value="${voice.voices[p.id]?.level ?? 1}" data-tune="part"><b data-out="lvl">${(voice.voices[p.id]?.level ?? 1).toFixed(2)}</b>
      <button data-mute>M</button><button data-solo>S</button>
      ${p.kind === 'drums' ? '' : `<button data-note="${p.id}">▶</button>`}</div>`).join('')}
    <div class="row"><span class="name">master</span><input type="range" min="0" max="0.4" step="0.01" value="${voice.level}" data-tune="master"><b data-out="master">${voice.level.toFixed(2)}</b></div>
    ${drumKeys.length ? `<h3>DRUM KEYS</h3><div class="row">${drumKeys.map((k) => `<span data-drum="${k}">${k} <select data-tune="drum">${sel(PIECES, voice.drumMap[k] ?? 'none')}</select><button data-hit="${k}">▶</button></span>`).join('')}</div>` : ''}
    <h3>TEMPO LADDER</h3>
    ${cfg.states.map((s, i) => `<div class="row" data-state="${i}"><span class="name">${s.label}</span>
      <input type="number" data-tune="bpm" value="${s.bpm}" min="30" max="250"><select data-tune="sec">${sectionOptions(s.section)}</select></div>`).join('')}
    <div class="row">
      <label>min <input type="number" data-tune="min" value="${cfg.minBpm}"></label>
      <label>max <input type="number" data-tune="max" value="${cfg.maxBpm}"></label>
      <label>ramp s <input type="number" data-tune="ramp" value="${cfg.rampSeconds}" step="0.5" min="0" max="20"></label></div>
    <div class="row">
      <label>driven by <select data-tune="drive">${sel(['phase', 'emotion'], cfg.drive)}</select></label>
      <label>tempo on <select data-tune="quant">${sel(QUANT, cfg.quantize)}</select></label>
      <label>section on <select data-tune="squant">${sel(QUANT, cfg.sectionQuantize)}</select></label></div>
    <div class="row">
      <label>event size <input type="number" data-tune="step" value="${cfg.step}" step="0.02" min="0.02" max="0.5"></label>
      <label>connection pull <input type="number" data-tune="pull" value="${cfg.weights.connection}" step="0.1" min="0" max="2"></label></div>
    <div class="row"><button data-act="save">SAVE</button><button data-act="reset">RESET</button><button data-act="copy">COPY JSON</button><small data-out="saved"></small></div>
    <small>Reference stems don't follow the tempo — judge the sound first, then the movement. Saved tuning also applies in the game.</small>
  `;

  const $ = (s) => box.querySelector(s);
  const out = (k, v) => { const el = $(`[data-out=${k}]`); if (el) el.textContent = v; };
  const bar = (k, v) => { $(`[data-bar=${k}]`).style.width = `${Math.round(v * 100)}%`; };
  let auto = null;
  const setAuto = (dir) => {
    clearInterval(auto);
    auto = null;
    box.querySelectorAll('[data-auto]').forEach((b) => b.classList.toggle('on', b.dataset.auto === dir));
    if (dir) auto = setInterval(() => { (dir === 'up' ? director.tensionIncreased() : (director.connectionSucceeded(), director.opponentCalmed())); director.answerGiven(); }, 1200);
  };

  // Tuning edits: write into `tuning`, apply live.
  function tuneTempo() {
    const t = (tuning.tempo = tuning.tempo ?? {});
    const num = (s) => Number($(s).value);
    cfg.minBpm = t.minBpm = num('[data-tune=min]');
    cfg.maxBpm = t.maxBpm = num('[data-tune=max]');
    cfg.rampSeconds = t.rampSeconds = num('[data-tune=ramp]');
    cfg.drive = t.drive = $('[data-tune=drive]').value;
    cfg.quantize = t.quantize = $('[data-tune=quant]').value;
    cfg.sectionQuantize = t.sectionQuantize = $('[data-tune=squant]').value;
    cfg.step = t.step = num('[data-tune=step]');
    cfg.weights.connection = num('[data-tune=pull]');
    t.weights = { connection: cfg.weights.connection };
    box.querySelectorAll('[data-state]').forEach((row) => {
      const s = cfg.states[Number(row.dataset.state)];
      s.bpm = Number(row.querySelector('[data-tune=bpm]').value);
      s.section = row.querySelector('[data-tune=sec]').value;
    });
    t.states = cfg.states.map((s) => ({ ...s }));
    director.refresh();
  }
  function tuneVoices() {
    tuning.level = Number($('[data-tune=master]').value);
    out('master', tuning.level.toFixed(2));
    box.querySelectorAll('[data-part]').forEach((row) => {
      const v = Number(row.querySelector('[data-tune=part]').value);
      tuning.voices[row.dataset.part] = { level: v };
      row.querySelector('[data-out=lvl]').textContent = v.toFixed(2);
    });
    box.querySelectorAll('[data-drum]').forEach((el) => {
      tuning.drums[el.dataset.drum] = el.querySelector('select').value;
    });
    player.setTuning(tuning);
  }
  // Only what differs from the code defaults is kept, so later default
  // improvements still reach settings you never changed.
  const clean = () => {
    const t = JSON.parse(JSON.stringify(tuning));
    if (t.level === DEFAULT_LEVEL) delete t.level;
    for (const [part, v] of Object.entries(t.voices ?? {})) {
      if (v.level === VOICE_SETS[data.id]?.[part]?.level) delete t.voices[part];
    }
    for (const [k, piece] of Object.entries(t.drums ?? {})) if (piece === DRUM_MAP[k]) delete t.drums[k];
    const d = DEFAULT_TEMPO_CONFIG;
    for (const k of ['minBpm', 'maxBpm', 'rampSeconds', 'quantize', 'sectionQuantize', 'step', 'drive']) if (t.tempo?.[k] === d[k]) delete t.tempo[k];
    if (t.tempo?.weights?.connection === d.weights.connection) delete t.tempo.weights;
    if (t.tempo?.states && JSON.stringify(t.tempo.states) === JSON.stringify(d.states)) delete t.tempo.states;
    for (const k of ['voices', 'drums', 'tempo']) if (t[k] && !Object.keys(t[k]).length) delete t[k];
    return t;
  };

  const onClick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'start') {
      const bpm = Number($('[data-in=bpm]').value);
      music.start(bpm ? { bpm, section: cfg.introSection } : { section: cfg.introSection });
      music.engage(bpm ? { bpm } : {});
    } else if (act === 'end') { setAuto(null); music.end({ fade: 0.2 }); }
    else if (act === 'secret') { const on = !t.classList.contains('on'); t.classList.toggle('on', on); player.setSecret(on, 2); }
    else if (act === 'goSection') player.queueSection($('[data-in=section]').value, 'pattern');
    else if (act === 'save') { saveTuning(data.id, clean()); out('saved', 'saved on this device'); }
    else if (act === 'reset') { resetTuning(data.id); out('saved', 'reset — reopen the track to see the defaults'); }
    else if (act === 'copy') {
      const text = JSON.stringify(clean(), null, 2);
      (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(() => out('saved', 'copied'), () => { out('saved', 'copy blocked — see console'); console.log(text); });
    } else if (t.dataset.ev) director[t.dataset.ev]();
    else if (t.dataset.auto) setAuto(t.classList.contains('on') ? null : t.dataset.auto);
    else if (t.hasAttribute('data-mute')) { const on = !t.classList.contains('on'); t.classList.toggle('on', on); player.setMuted(t.closest('[data-part]').dataset.part, on); }
    else if (t.hasAttribute('data-solo')) { const on = !t.classList.contains('on'); t.classList.toggle('on', on); player.setSolo(t.closest('[data-part]').dataset.part, on); }
    else if (t.dataset.note) player.audition(t.dataset.note, 48);
    else if (t.dataset.hit && drumPart) player.audition(drumPart.id, Number(t.dataset.hit));
  };
  const onInput = (e) => {
    const k = e.target.dataset.tune;
    if (!k) return;
    if (k === 'part' || k === 'master' || k === 'drum') tuneVoices(); else tuneTempo();
  };
  box.addEventListener('click', onClick);
  box.addEventListener('input', onInput);

  const tick = setInterval(() => {
    const s = director.state();
    const p = player.state();
    out('bpm', p.playing ? p.bpm.toFixed(1) : '–');
    out('target', `${s.targetBpm.toFixed(1)}${p.playing ? ` (clock → ${p.targetBpm.toFixed(0)})` : ''}`);
    out('state', `${s.label}${s.active ? '' : ' · ended'}`);
    out('answers', `${s.answers} (full band from ${director.config.fullAfterAnswers})`);
    out('section', `${p.section}${p.pendingSection ? ` → ${p.pendingSection}` : ''}`);
    out('pos', p.playing ? `bar ${p.bar}/${p.bars} beat ${p.beat}` : 'stopped');
    out('voices', String(p.voices));
    out('parts', data.parts.map((x) => `${p.active?.[x.id] ? '●' : '○'} ${x.label}`).join('  '));
    ['tension', 'agitation', 'connection', 'level'].forEach((k) => bar(k, s[k]));
  }, 100);

  return () => {
    clearInterval(tick);
    clearInterval(auto);
    box.removeEventListener('click', onClick);
    box.removeEventListener('input', onInput);
    music.end({ fade: 0.1 });
  };
}
