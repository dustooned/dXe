// A real oscilloscope, not a decorative animation guessing at one — reads
// shell/audio.js's shared AnalyserNode (tapped off masterGain) via
// getByteTimeDomainData(), so the waveform is whatever's actually playing
// (an NPC's leitmotif, a sting, ambient) at that instant. First use:
// confrontation cutscenes' empty background real estate
// (scenes/cutsceneScene.js).
import { getAnalyser } from '../shell/audio.js';

export function createOscilloscope(canvas, { color = '#ffffff', lineWidth = 2 } = {}) {
  const analyser = getAnalyser();
  const bufferLength = analyser.fftSize;
  const data = new Uint8Array(bufferLength);
  const ctx2d = canvas.getContext('2d');
  let rafId = null;

  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    analyser.getByteTimeDomainData(data);
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.lineWidth = lineWidth;
    ctx2d.strokeStyle = color;
    ctx2d.beginPath();

    const sliceWidth = w / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128; // 0..2, 1.0 = silence (midline)
      const y = (v * h) / 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += sliceWidth;
    }
    ctx2d.stroke();
    rafId = requestAnimationFrame(draw);
  }
  rafId = requestAnimationFrame(draw);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    },
  };
}
