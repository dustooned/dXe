export function createDebtSigil(initial = 0) {
  const el = document.createElement('div');
  el.className = 'dx-debt-sigil';

  function update(value) {
    el.textContent = `DEBT ${value}`;
    el.classList.toggle('is-elevated', value >= 3 && value < 8);
    el.classList.toggle('is-critical', value >= 8);
  }

  update(initial);
  return { el, update };
}
