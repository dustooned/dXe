// A FEELZ push notification: text only, no portrait, so the player meets the
// next person as a case file before they ever see a face. Used by the
// Therapist outro's NOTIFY beat (the homework assignment). Same overlay
// contract as ui/itPopup.js: mounts inside `stageEl` without clearing it,
// calls `onClose` once when tapped, and the caller destroys it.
//
// `text` lines: first is the app header, second the headline, the rest body.
export function createFeelzNotification(stageEl, { text, onClose } = {}) {
  const [header = '', headline = '', ...body] = text.split('\n');

  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-notify-screen';

  const card = document.createElement('div');
  card.className = 'dx-notify';
  card.setAttribute('role', 'alert');

  const head = document.createElement('p');
  head.className = 'dx-notify__header';
  head.textContent = header;

  const title = document.createElement('p');
  title.className = 'dx-notify__headline';
  title.textContent = headline;

  card.append(head, title);
  for (const line of body) {
    const p = document.createElement('p');
    p.className = 'dx-notify__line';
    p.textContent = line;
    card.appendChild(p);
  }

  const hint = document.createElement('p');
  hint.className = 'dx-notify__dismiss';
  hint.textContent = '[ TAP TO DISMISS ]';
  card.appendChild(hint);

  screen.appendChild(card);
  stageEl.appendChild(screen);

  let closed = false;
  screen.addEventListener('click', () => {
    if (closed) return;
    closed = true;
    onClose?.();
  });

  return { destroy: () => screen.remove() };
}
