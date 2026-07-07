// DX_DEMO_BUILD_SPEC.md section 8: ending selection by final Truth Debt
export function getEndingKey(truthDebt) {
  if (truthDebt <= 3) return 'CLEAN_CUT';
  if (truthDebt <= 6) return 'FUNCTIONAL_MASK';
  return 'LIVING_LIE';
}
