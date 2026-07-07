import { clamp } from './util.js';

// DX_DEMO_BUILD_SPEC.md section 6.1
export const BLOOM_THRESHOLDS = [3, 6, 8, 10];

export function lakeHealthFor(truthDebt) {
  return clamp(1 - truthDebt / 10, 0, 1);
}

// Checks which thresholds have been newly crossed since last check.
// Each threshold fires its bloom event exactly once per run.
export function checkBloomTriggers(state) {
  const fired = [...state.bloomsFired];
  const newlyFired = [];

  for (const threshold of BLOOM_THRESHOLDS) {
    const id = `bloom_${threshold}`;
    if (state.truthDebt >= threshold && !fired.includes(id)) {
      fired.push(id);
      newlyFired.push(threshold);
    }
  }

  return {
    patch: { bloomsFired: fired, lakeHealth: lakeHealthFor(state.truthDebt) },
    newlyFired,
  };
}
