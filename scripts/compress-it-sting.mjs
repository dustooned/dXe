#!/usr/bin/env node
// One-off recompression pass for the new IT sting — its own dedicated file,
// separate from tyagl.mp3 (the Therapist diagnosis-reveal sting; IT reused
// it as a placeholder before this asset existed, see HANDOFF.md). The
// source (E:/2026/Music/dXe/SFX/IT/IT.wav) is a 48kHz 32-bit-float stereo
// WAV, and the delivered IT.mp3 alongside it is encoded at 320kbps CBR —
// full broadcast quality for a ~1.7s UI sting nobody's meant to critically
// listen to. Re-encodes from the lossless WAV at 128kbps stereo, matching
// this project's existing one-shot SFX convention (see tyagl.mp3, encoded
// the same way) rather than shipping the 320kbps file as-is.
//
// Usage: node scripts/compress-it-sting.mjs
import wav from 'node-wav';
import lamejs from '@breezystack/lamejs';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const SOURCE_WAV = 'E:/2026/Music/dXe/SFX/IT/IT.wav';
const OUTPUT_MP3 = 'public/assets/shared/audio/it_sting.mp3';
const BITRATE_KBPS = 128;

function floatTo16BitPCM(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

const before = statSync(SOURCE_WAV.replace('IT.wav', 'IT.mp3')).size;

const { sampleRate, channelData } = wav.decode(readFileSync(SOURCE_WAV));
const [left, right] = channelData.map(floatTo16BitPCM);

const encoder = new lamejs.Mp3Encoder(2, sampleRate, BITRATE_KBPS);
const chunks = [];
const blockSize = 1152; // MP3 frame size
for (let i = 0; i < left.length; i += blockSize) {
  const chunk = encoder.encodeBuffer(left.subarray(i, i + blockSize), right.subarray(i, i + blockSize));
  if (chunk.length) chunks.push(Buffer.from(chunk));
}
const final = encoder.flush();
if (final.length) chunks.push(Buffer.from(final));

const output = Buffer.concat(chunks);
writeFileSync(OUTPUT_MP3, output);

console.log(`320kbps source IT.mp3: ${(before / 1024).toFixed(1)}KB`);
console.log(`Re-encoded ${OUTPUT_MP3}: ${(output.length / 1024).toFixed(1)}KB (${BITRATE_KBPS}kbps, ${sampleRate}Hz stereo)`);
