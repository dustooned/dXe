// Animates a sprite sequence by cycling through numbered WebP frames via RAF.
// Continuity: pass startFrame so a sequence resumes where it left off when
// the same animation plays across consecutive beats.
//
// anim shape: { base: '/path/spr_name_', frames: 46, fps: 12, ext?: 'webp' }
// `ext` defaults to webp — the real asset format. It exists so placeholder
// frame sequences can be committed as SVG without producing throwaway binaries.
const PAD = (n) => String(n).padStart(4, '0');

export function createSpriteAnimator(imgEl, anim, startFrame = 0) {
  let frame = startFrame % anim.frames;
  let lastTime = null; // null = not yet set; avoids skipping frame 0 on first tick
  const msPerFrame = 1000 / (anim.fps ?? 12);
  const ext = anim.ext ?? 'webp';
  let rafId = null;

  imgEl.src = `${anim.base}${PAD(frame)}.${ext}`;

  function tick(now) {
    if (lastTime === null || now - lastTime >= msPerFrame) {
      if (lastTime !== null) {
        frame = (frame + 1) % anim.frames;
        imgEl.src = `${anim.base}${PAD(frame)}.${ext}`;
      }
      lastTime = now;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  return {
    destroy() { cancelAnimationFrame(rafId); },
    get currentFrame() { return frame; },
  };
}
