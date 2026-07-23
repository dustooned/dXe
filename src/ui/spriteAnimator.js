// Animates a sprite sequence by cycling through numbered WebP frames via RAF.
// Continuity: pass startFrame so a sequence resumes where it left off when
// the same animation plays across consecutive beats.
//
// anim shape: { base: '/path/spr_name_', frames: 46, fps: 12 }
const PAD = (n) => String(n).padStart(4, '0');

export function createSpriteAnimator(imgEl, anim, startFrame = 0) {
  let frame = startFrame % anim.frames;
  let lastTime = null; // null = not yet set; avoids skipping frame 0 on first tick
  const msPerFrame = 1000 / (anim.fps ?? 12);
  let rafId = null;

  imgEl.src = `${anim.base}${PAD(frame)}.webp`;

  function tick(now) {
    if (lastTime === null || now - lastTime >= msPerFrame) {
      if (lastTime !== null) {
        frame = (frame + 1) % anim.frames;
        imgEl.src = `${anim.base}${PAD(frame)}.webp`;
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
