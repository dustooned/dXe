// Scene type: 'reckoning'. Builds a confess/double-down deck from the run's
// ledger and plays it out. If the ledger is empty (no lies told), completes
// immediately — there's nothing to reckon with. See docs/SCENE_TYPES.md.
//
// scene shape: { type: 'reckoning', id: string }
import { buildReckoningDeck, resolveReckoningCard } from '../engine/reckoning.js';

export function mount(stageEl, scene, { run, onComplete }) {
  const deck = buildReckoningDeck(run.get().ledger);
  let cardIndex = 0;

  if (deck.length === 0) {
    onComplete();
    return function unmount() {};
  }

  function render() {
    stageEl.innerHTML = '';
    const card = deck[cardIndex];

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-reckoning-screen';

    const header = document.createElement('h2');
    header.className = 'dx-title';
    header.textContent = `RECKONING ${cardIndex + 1}/${deck.length}`;
    screen.appendChild(header);

    const text = document.createElement('p');
    text.className = 'dx-text';
    text.textContent = card.ledgerText;
    screen.appendChild(text);

    const choices = document.createElement('div');
    choices.className = 'dx-menu';

    const confessBtn = document.createElement('button');
    confessBtn.className = 'dx-btn';
    confessBtn.textContent = 'CONFESS (truth)';
    confessBtn.addEventListener('click', () => handleChoice(card, 'confess'));

    const doubleDownBtn = document.createElement('button');
    doubleDownBtn.className = 'dx-btn';
    doubleDownBtn.textContent = 'DOUBLE DOWN (lie)';
    doubleDownBtn.addEventListener('click', () => handleChoice(card, 'doubleDown'));

    choices.append(confessBtn, doubleDownBtn);
    screen.appendChild(choices);
    stageEl.appendChild(screen);
  }

  function handleChoice(card, choice) {
    const { patch } = resolveReckoningCard(run.get(), card, choice);
    run.set(patch);
    cardIndex += 1;
    if (cardIndex < deck.length) render();
    else onComplete();
  }

  render();

  return function unmount() {
    stageEl.innerHTML = '';
  };
}
