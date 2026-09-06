// Colored-initial placeholder until real portrait art lands (see docs/CONTENT_SCHEMA.md
// asset spec) — an NPC's content JSON can carry a `portrait` path once art exists,
// authored via the manuscript's `PORTRAIT:` header (SCRIPT_FORMAT.md); omitting it
// keeps today's placeholder.
export function createNpcPortrait(npcName, accentColor, portraitUrl) {
  const el = document.createElement('div');
  el.className = 'dx-portrait';
  el.style.setProperty('--accent', accentColor || 'var(--color-white)');

  if (portraitUrl) {
    const img = document.createElement('img');
    img.className = 'dx-portrait__img';
    img.src = portraitUrl;
    img.alt = npcName;
    el.appendChild(img);
  } else {
    el.textContent = npcName.charAt(0).toUpperCase();
  }

  const nameplate = document.createElement('div');
  nameplate.className = 'dx-nameplate';
  nameplate.textContent = npcName;

  return { el, nameplate };
}
