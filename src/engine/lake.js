// Lake Ulysses as a readout of Truth Debt. The lake doesn't know or care
// how the player feels — it's a water-quality sensor, and its numbers are
// the one thing in FEELZ that never softens anything. Modeled on a real
// TDS (total dissolved solids) chart: clean blue at the bottom of the
// scale, swamp green past the "EPA limit" at the top.
//
// Status bands line up with the ending tiers (endingEngine.js's
// getEndingKey: <=2 / <=5 / <=7 / 8+) and with the bloom thresholds
// (debtEngine.js: 3/6/8/10), so every time the reading changes status,
// the ending the player is heading toward just changed with it.
import { clamp } from './util.js';

export const LAKE_MAX_DEBT = 10;
// The chart's own tick labels (ui/lakeGauge.js).
export const PPM_TICKS = [0, 100, 200, 300, 400, 500];

// Clean → swamp. Stops are at debt 0, 2, 4, 6, 8, 10.
export const LAKE_COLORS = ['#35c4f2', '#2a8fd6', '#24808f', '#3f7f45', '#6b7a22', '#98a11f'];

// 0 debt reads 20 ppm (reverse-osmosis clean), 10 reads 520 (over limit).
export function ppmFor(truthDebt) {
  return 20 + clamp(truthDebt, 0, LAKE_MAX_DEBT) * 50;
}

export function statusFor(truthDebt) {
  if (truthDebt <= 2) return 'IDEAL';
  if (truthDebt <= 5) return 'MARGINAL';
  if (truthDebt <= 7) return 'HIGH';
  if (truthDebt <= 9) return 'CONTAMINATED';
  return 'OVER LIMIT';
}

// 0 = thriving fish … 4 = belly-up (ui/lakeGauge.js's tamagotchi).
export function fishStageFor(truthDebt) {
  if (truthDebt <= 2) return 0;
  if (truthDebt <= 5) return 1;
  if (truthDebt <= 7) return 2;
  if (truthDebt <= 9) return 3;
  return 4;
}

export function colorFor(truthDebt) {
  const i = Math.round(clamp(truthDebt, 0, LAKE_MAX_DEBT) / 2);
  return LAKE_COLORS[i];
}

// Lets IT/SO lines quote the live reading ("Reading's at {ppm}.") — the
// observers cite the data, they don't editorialize it.
export function fillReadings(text, truthDebt) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\{ppm\}/g, String(ppmFor(truthDebt)))
    .replace(/\{status\}/g, statusFor(truthDebt));
}
