// The FEELZ feed's timing (scenes/feedScene.js), kept free of browser code so
// the engine tests can run it: how long each beat stays up, where each beat
// starts on its channel, and which beat is showing at a time.
const SPEED = { normal: 1, fast: 0.75, instant: 0.6 };

// How long a beat stays up: enough to read it at the player's text speed.
export function readingMs(beat, speed = 'normal') {
  if (beat.holdMs) return beat.holdMs;
  if (beat.autoAdvanceMs) return beat.autoAdvanceMs;
  const chars = String(beat.text ?? '').replace(/\{[^}]*\}/g, '').length;
  return Math.round((1800 + chars * 55) * (SPEED[speed] ?? 1));
}

// Each beat's start time on its channel, and the channel's length.
export function timeline(channel, speed) {
  let t = 0;
  const starts = channel.beats.map((b) => { const at = t; t += readingMs(b, speed); return at; });
  return { starts, length: t };
}

export function beatAt(starts, pos) {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= pos) i += 1;
  return i;
}
