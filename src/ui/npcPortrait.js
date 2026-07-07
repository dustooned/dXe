// Placeholder 1-bit-style portrait until real sprites land (see docs/CONTENT_SCHEMA.md
// asset spec). Swap the textContent glyph for an <img> once art exists — same element shape.
export function createNpcPortrait(npcName, accentColor) {
  const el = document.createElement('div');
  el.className = 'dx-portrait';
  el.style.setProperty('--accent', accentColor || 'var(--color-white)');
  el.textContent = npcName.charAt(0).toUpperCase();

  const nameplate = document.createElement('div');
  nameplate.className = 'dx-nameplate';
  nameplate.textContent = npcName;

  return { el, nameplate };
}
