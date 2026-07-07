// 3-segment picker for the demo (DX_DEMO_BUILD_SPEC.md: "3 segments for demo").
// Swap for a real SVG dartboard wheel post-demo — onSelect contract stays the same.
const EMOTION_VAR = {
  Anger: '--color-feelz-anger',
  Fear: '--color-feelz-fear',
  Anticipation: '--color-feelz-anticipation',
};

export function createFeelzWheel({ options, onSelect }) {
  const el = document.createElement('div');
  el.className = 'dx-feelz';

  options.forEach((emotion) => {
    const btn = document.createElement('button');
    btn.className = 'dx-feelz__bubble';
    btn.type = 'button';
    btn.style.setProperty('--bubble-color', `var(${EMOTION_VAR[emotion] || '--color-white'})`);
    btn.textContent = emotion;
    btn.addEventListener('click', () => {
      el.querySelectorAll('.dx-feelz__bubble').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      onSelect?.(emotion);
    });
    el.appendChild(btn);
  });

  function reset() {
    el.querySelectorAll('.dx-feelz__bubble').forEach((b) => b.classList.remove('is-selected'));
  }

  return { el, reset };
}
