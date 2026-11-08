// The way in: a small, skippable moment before each NPC's chapter page. The
// screen says exactly what to do; the page turns in only after you've done it
// (or tapped SKIP). White on black like the page itself, no right or wrong:
// nothing here can be failed.
//
//   createWayIn(stageEl, kind, { onDone }) -> { destroy }
//   kind: 'bulb' (Deborah), 'spray' (Rwanda), 'crosswalk' (Samun), 'rev' (Rick)
import { playSfx } from '../shell/audio.js';

const KINDS = {
  // Twist the hall bulb in: drag sideways, it turns and brightens.
  bulb(body, finish, say) {
    say('TWIST THE BULB IN\ndrag left and right');
    const bulb = document.createElement('div');
    bulb.className = 'dx-wayin__bulb';
    body.appendChild(bulb);
    let turn = 0, lastX = null, lastClick = 0;
    const NEED = 900; // px of dragging
    const move = (e) => {
      if (lastX == null) return;
      turn += Math.abs(e.clientX - lastX);
      lastX = e.clientX;
      const p = Math.min(1, turn / NEED);
      bulb.style.setProperty('--lit', String(p));
      bulb.style.transform = `rotate(${Math.sin(turn / 40) * 14}deg)`;
      if (turn - lastClick > 90) { lastClick = turn; playSfx('click'); }
      if (p >= 1) { lastX = null; bulb.classList.add('is-lit'); playSfx('buzz'); say('IT HOLDS.'); finish(700); }
    };
    bulb.addEventListener('pointerdown', (e) => { lastX = e.clientX; bulb.setPointerCapture(e.pointerId); });
    bulb.addEventListener('pointermove', move);
    bulb.addEventListener('pointerup', () => { lastX = null; });
    bulb.addEventListener('pointercancel', () => { lastX = null; });
  },

  // Brush a mask across the wall to reveal what was painted under it.
  spray(body, finish, say) {
    say('SPRAY THE WALL\nrub it clear with your finger');
    const W = 240, H = 150;
    const wrap = document.createElement('div');
    wrap.className = 'dx-wayin__wall';
    const under = document.createElement('p');
    under.className = 'dx-wayin__under';
    under.textContent = 'SOMEBODY\nWAS\nHERE';
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    wrap.append(under, cv);
    body.appendChild(wrap);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // Painted over: a dither of near-black so it reads as a wall.
    ctx.fillStyle = '#222';
    for (let y = 0; y < H; y += 2) for (let x = (y / 2) % 2 ? 0 : 1; x < W; x += 2) ctx.fillRect(x, y, 1, 1);
    let down = false, done = false, last = 0;
    const paint = (e) => {
      if (!down || done) return;
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const y = ((e.clientY - r.top) / r.height) * H;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      const now = performance.now();
      if (now - last > 90) { last = now; playSfx('fizz'); }
      // How much is cleared (sampled coarsely, cheap enough for a finger).
      const d = ctx.getImageData(0, 0, W, H).data;
      let clear = 0, n = 0;
      for (let i = 3; i < d.length; i += 4 * 37) { n++; if (d[i] < 40) clear++; }
      if (clear / n > 0.45) { done = true; cv.style.opacity = '0'; say('SOMEBODY WAS HERE.'); finish(900); }
    };
    cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); paint(e); });
    cv.addEventListener('pointermove', paint);
    cv.addEventListener('pointerup', () => { down = false; });
    cv.addEventListener('pointercancel', () => { down = false; });
  },

  // A crosswalk button, hit impatiently. The fourth press is the chirp.
  crosswalk(body, finish, say) {
    say('PRESS THE BUTTON');
    const sign = document.createElement('p');
    sign.className = 'dx-wayin__sign';
    sign.textContent = 'DON’T WALK';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dx-wayin__button';
    btn.setAttribute('aria-label', 'Crosswalk button');
    body.append(sign, btn);
    const replies = ['WAIT', 'WAIT', 'WAIT!!'];
    let n = 0;
    btn.addEventListener('click', () => {
      if (n >= 4) return;
      btn.classList.remove('is-pressed'); void btn.offsetWidth; btn.classList.add('is-pressed');
      if (n < 3) { sign.textContent = replies[n]; playSfx('click'); say(n === 0 ? 'PRESS IT AGAIN' : n === 1 ? 'AGAIN' : 'ONE MORE'); }
      else { sign.textContent = 'WALK'; sign.classList.add('is-walk'); btn.classList.add('is-done'); playSfx('ping'); say('CHIRP.'); finish(1000); }
      n++;
    });
  },

  // Rev a motorcycle: the first press sputters, the second catches.
  rev(body, finish, say) {
    say('REV IT\npress the throttle');
    const gauge = document.createElement('p');
    gauge.className = 'dx-wayin__gauge';
    gauge.textContent = '. . .';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dx-wayin__button dx-wayin__button--throttle';
    btn.textContent = 'THROTTLE';
    body.append(gauge, btn);
    let n = 0;
    btn.addEventListener('click', () => {
      if (n >= 2) return;
      n++;
      if (n === 1) {
        gauge.textContent = 'rrr… rrr… rr…';
        [0, 0.28, 0.56].forEach((dt, i) => setTimeout(() => playSfx(i ? 'whir' : 'cough'), dt * 1000));
        say('IT COUGHS. AGAIN.');
      } else {
        gauge.textContent = 'RRRRRRMMMM';
        gauge.classList.add('is-caught');
        playSfx('whir'); setTimeout(() => playSfx('whir'), 220); setTimeout(() => playSfx('bump'), 480);
        say('IT CATCHES.');
        finish(1000);
      }
    });
  },
};

export function createWayIn(stageEl, kind, { onDone } = {}) {
  const make = KINDS[kind];
  if (!make) { onDone?.(); return { destroy() {} }; }
  const el = document.createElement('div');
  el.className = `dx-screen dx-wayin dx-wayin--${kind}`;
  const prompt = document.createElement('p');
  prompt.className = 'dx-text dx-wayin__prompt';
  const body = document.createElement('div');
  body.className = 'dx-wayin__body';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'dx-btn dx-wayin__skip';
  skip.textContent = 'SKIP ▶';
  el.append(prompt, body, skip);
  stageEl.appendChild(el);

  let timer = null, closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => { el.remove(); onDone?.(); }, 350);
  };
  skip.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  el.addEventListener('click', (e) => e.stopPropagation());
  make(body, (ms) => { timer = setTimeout(close, ms); }, (t) => { prompt.textContent = t; });
  return { destroy() { closed = true; clearTimeout(timer); el.remove(); } };
}
