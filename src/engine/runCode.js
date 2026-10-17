// The run code (Phase 11 step 8): your unlocks and your last few runs packed
// into one short string, the same thing three ways: the QR on the record, a
// link (<site>/#r=<code>, the data after the # never reaches a server), and a
// save file. Opening it shows a read-only run card; IMPORT merges it into
// this device's save. No personal data: class, ending, numbers, who trusted
// you, and the made-up FEELZ username. The checksum catches a typo or a
// broken scan, not cheating (a local single-player game, that's fine).
//
// Packed as [version, endingsSeen, chaptersCompleted, runs], each run
// [id, yyyymmdd, chapter, class, ending, debt, lies, trusted, heard, handle]
// (trusted/heard as NPC initials), as JSON, UTF-8, base64url, then '.' and
// four hex digits of checksum.

import { isTrusted } from './trust.js';

export const CODE_VERSION = 1;
export const RUNS_IN_CODE = 5;    // the QR stays small enough to scan off a screen
export const HISTORY_MAX = 50;    // runs kept on this device

const NPC_INITIALS = { DEBORAH: 'D', RWANDA: 'W', SAMUN: 'S', RICK: 'R' };
const INITIAL_NPCS = Object.fromEntries(Object.entries(NPC_INITIALS).map(([k, v]) => [v, k]));
const CLASS_INITIALS = { Guns: 'G', Bible: 'B', Crystals: 'C' };
const INITIAL_CLASSES = Object.fromEntries(Object.entries(CLASS_INITIALS).map(([k, v]) => [v, k]));

function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return (h & 0xffff).toString(16).padStart(4, '0');
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(code) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const initials = (list, map) => (list ?? []).map((n) => map[n] ?? '').join('');
const fromInitials = (text, map) => [...(text ?? '')].map((c) => map[c]).filter(Boolean);

// One finished run, as the device keeps it (save.history), from the run state.
export function runEntry(state, { endingKey, chapterId, file, at = new Date() }) {
  const lies = Object.values(state.choices ?? {}).filter((s) => s === 'lie').length;
  const trusted = Object.keys(NPC_INITIALS).filter((n) => isTrusted(state.bonds?.[n]));
  return {
    id: file,
    at: at.toISOString().slice(0, 10),
    chapter: chapterId,
    loadout: state.loadout ?? null,
    endingKey,
    truthDebt: state.truthDebt ?? 0,
    lies,
    trusted,
    heard: (state.storiesHeard ?? []).filter((n) => NPC_INITIALS[n]),
    handle: state.handle ?? null,
  };
}

export function encodeRunCode(save) {
  const runs = (save.history ?? []).slice(-RUNS_IN_CODE).map((r) => [
    r.id, Number(String(r.at).replace(/-/g, '')), r.chapter, CLASS_INITIALS[r.loadout] ?? '', r.endingKey,
    r.truthDebt, r.lies, initials(r.trusted, NPC_INITIALS), initials(r.heard, NPC_INITIALS), r.handle ?? '',
  ]);
  const body = toBase64Url(JSON.stringify([CODE_VERSION, save.endingsSeen ?? [], save.chaptersCompleted ?? [], runs]));
  return `${body}.${checksum(body)}`;
}

// { ok: true, data: { endingsSeen, chaptersCompleted, history } } or
// { ok: false, why } ('empty' | 'checksum' | 'unreadable' | 'version').
export function decodeRunCode(code) {
  const text = String(code ?? '').trim();
  if (!text) return { ok: false, why: 'empty' };
  const dot = text.lastIndexOf('.');
  const body = dot > 0 ? text.slice(0, dot) : text;
  if (dot <= 0 || checksum(body) !== text.slice(dot + 1).toLowerCase()) return { ok: false, why: 'checksum' };
  let packed;
  try { packed = JSON.parse(fromBase64Url(body)); } catch { return { ok: false, why: 'unreadable' }; }
  if (!Array.isArray(packed) || packed[0] !== CODE_VERSION) return { ok: false, why: 'version' };
  const [, endingsSeen, chaptersCompleted, runs] = packed;
  const history = (runs ?? []).map(([id, at, chapter, cls, endingKey, truthDebt, lies, trusted, heard, handle]) => ({
    id, at: `${String(at).slice(0, 4)}-${String(at).slice(4, 6)}-${String(at).slice(6, 8)}`, chapter,
    loadout: INITIAL_CLASSES[cls] ?? null, endingKey, truthDebt, lies,
    trusted: fromInitials(trusted, INITIAL_NPCS), heard: fromInitials(heard, INITIAL_NPCS), handle: handle || null,
  }));
  return { ok: true, data: { endingsSeen: endingsSeen ?? [], chaptersCompleted: chaptersCompleted ?? [], history } };
}

// Import: what this device has, plus what the code adds (nothing is lost).
export function mergeSave(save, data) {
  const union = (a = [], b = []) => [...new Set([...a, ...b])];
  const byId = new Map((save.history ?? []).map((r) => [r.id, r]));
  for (const r of data.history ?? []) if (!byId.has(r.id)) byId.set(r.id, r);
  const history = [...byId.values()].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-HISTORY_MAX);
  return {
    ...save,
    endingsSeen: union(save.endingsSeen, data.endingsSeen),
    chaptersCompleted: union(save.chaptersCompleted, data.chaptersCompleted),
    history,
  };
}

// The link a QR or a share carries.
export function runLink(code, origin = globalThis.location?.origin ?? '') {
  return `${origin}/#r=${code}`;
}
