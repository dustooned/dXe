const METERS = [
  { key: 'integrity', label: 'INT' },
  { key: 'trust', label: 'TRU' },
  { key: 'stability', label: 'STB' },
  { key: 'lucidity', label: 'LUC' },
];

export function createMeterGroup(initialStats) {
  const el = document.createElement('div');
  el.className = 'dx-meters';

  const fills = {};
  for (const { key, label } of METERS) {
    const meter = document.createElement('div');
    meter.className = 'dx-meter';
    meter.innerHTML = `
      <span class="dx-meter__label">${label}</span>
      <div class="dx-meter__track"><div class="dx-meter__fill"></div></div>
    `;
    fills[key] = meter.querySelector('.dx-meter__fill');
    el.appendChild(meter);
  }

  function update(stats) {
    for (const { key } of METERS) {
      const value = stats[key] ?? 0;
      fills[key].style.width = `${(value / 10) * 100}%`;
      fills[key].classList.toggle('is-low', value <= 3);
    }
  }

  update(initialStats);
  return { el, update };
}
