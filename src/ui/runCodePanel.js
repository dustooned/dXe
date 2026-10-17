// SAVE & HISTORY (Phase 11 step 8): this device's run code as a QR and a
// link, a save file to download or import, and the runs played here. Opened
// from the ending (RUN CODE) and from Settings. The code is the save
// (engine/runCode.js): scanning it on another phone, or importing the file,
// brings your endings and history along, merged, never replacing.
import { encodeRunCode, decodeRunCode, runLink } from '../engine/runCode.js';
import { loadSave, importSave } from '../shell/save.js';
import { createQrCanvas } from './qrCode.js';
import { playSfx } from '../shell/audio.js';

const HISTORY_SHOWN = 8;
const pretty = (key) => String(key ?? '—').replace(/_/g, ' ');

// One line per run, newest first: date, class, ending, lies, who trusted you.
export function historyLine(r) {
  const trusted = r.trusted?.length ? ` · TRUSTED BY ${r.trusted.join(', ')}` : '';
  return `${r.at} · ${(r.loadout ?? '—').toUpperCase()} · ${pretty(r.endingKey)} · ${r.lies} ${r.lies === 1 ? 'LIE' : 'LIES'}${trusted}`;
}

// A save file: the code plus a little label, so it can't be mistaken.
function downloadSave(code) {
  const blob = new Blob([JSON.stringify({ app: 'dream-xtreme', kind: 'run-code', code, saved: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dreamxtreme_save_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// A save file or a pasted link/code -> the code inside it.
export function codeFrom(text) {
  const t = String(text ?? '').trim();
  try { const j = JSON.parse(t); if (j?.code) return j.code; } catch { /* not JSON */ }
  const m = t.match(/#r=([^\s]+)/);
  return m ? m[1] : t;
}

export function openRunCodePanel(host = document.querySelector('.dx-canvas')) {
  const panel = document.createElement('div');
  panel.className = 'dx-runcode';
  panel.innerHTML = `
    <div class="dx-runcode__box">
      <h3 class="dx-runcode__title">SAVE &amp; HISTORY</h3>
      <div class="dx-runcode__qr"></div>
      <p class="dx-text dx-runcode__note">Scan it, or open the link, on any phone. It carries your endings and your last runs. It never leaves your device unless you send it.</p>
      <div class="dx-runcode__actions">
        <button type="button" class="dx-btn dx-runcode__copy">COPY LINK</button>
        <button type="button" class="dx-btn dx-runcode__download">DOWNLOAD SAVE</button>
        <label class="dx-btn dx-runcode__import">IMPORT SAVE<input type="file" accept=".json,application/json,text/plain" hidden></label>
      </div>
      <p class="dx-text dx-runcode__status" aria-live="polite"></p>
      <h4 class="dx-runcode__sub">RUNS ON THIS DEVICE</h4>
      <ol class="dx-runcode__history"></ol>
      <button type="button" class="dx-btn dx-runcode__close">CLOSE</button>
    </div>`;
  const status = panel.querySelector('.dx-runcode__status');
  const say = (text) => { status.textContent = text; };
  let link = '';

  function render() {
    const save = loadSave();
    const code = encodeRunCode(save);
    link = runLink(code);
    const qr = panel.querySelector('.dx-runcode__qr');
    qr.replaceChildren(createQrCanvas(link, 220));
    const list = panel.querySelector('.dx-runcode__history');
    list.replaceChildren();
    const runs = (save.history ?? []).slice(-HISTORY_SHOWN).reverse();
    if (!runs.length) {
      const li = document.createElement('li');
      li.textContent = 'No finished runs yet.';
      list.appendChild(li);
    }
    for (const r of runs) {
      const li = document.createElement('li');
      li.textContent = historyLine(r);
      list.appendChild(li);
    }
    panel.dataset.code = code;
  }

  panel.querySelector('.dx-runcode__copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); say('LINK COPIED'); }
    catch { window.prompt('Copy your run link:', link); }
    playSfx('tap');
  });
  panel.querySelector('.dx-runcode__download').addEventListener('click', () => {
    downloadSave(panel.dataset.code);
    say('SAVE FILE DOWNLOADED');
    playSfx('tap');
  });
  panel.querySelector('.dx-runcode__import input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = decodeRunCode(codeFrom(await file.text()));
    if (!result.ok) { say("THAT FILE ISN'T A DREAM XTREME SAVE"); playSfx('static'); return; }
    importSave(result.data);
    render();
    say(`IMPORTED ${result.data.history.length} ${result.data.history.length === 1 ? 'RUN' : 'RUNS'}`);
    playSfx('ping');
  });
  const close = () => panel.remove();
  panel.querySelector('.dx-runcode__close').addEventListener('click', close);
  panel.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === panel) close(); });
  // Taps inside never fall through to the scene underneath.
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  render();
  host.appendChild(panel);
  return { el: panel, close };
}
