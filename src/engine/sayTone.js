// A short, fixed tail appended to the player's authored SAY: line, keyed by
// which FEELZ emotion was active and which way they swiped. Same trick as
// engine/reactions.js's NPC-side codas, applied to the player's own line
// instead — universal across every NPC (Deborah, Rwanda, Samun, Rick,
// Therapist all run the same dialogScene.js), so this one table covers all
// of them with no per-NPC authoring.
const SAY_CODA = {
  Anger:        { truth: '. I’m done pretending otherwise.',                 lie: ', so drop it.' },
  Fear:         { truth: ', and I don’t know what happens now.',             lie: ', and please just leave it there.' },
  Anticipation: { truth: '—you’ll want to know before you find out some other way.', lie: ', so we don’t have to get into the rest.' },
  Trust:        { truth: '. I think you can handle it.',                          lie: ', and I need you to believe me.' },
  Disgust:      { truth: '. I can’t keep saying otherwise.',                 lie: ', and I’d rather not say more.' },
  Joy:          { truth: '—and honestly, it feels good to finally say it.',  lie: ', and everything’s fine, really.' },
  Sadness:      { truth: '—I’m sorry it’s this.',                  lie: ', and it’s easier this way.' },
  Surprise:     { truth: '—even I didn’t expect to say it like that.',  lie: ', so let’s just leave it at that.' },
};

// Every coda above is written to continue the base line's last clause, not
// start a new one after its closing punctuation — so that punctuation
// (.!?) is stripped first, same idea as dropping a trailing comma before
// adding "and...".
export function composeSay(baseSayText, emotion, swipeKey) {
  const coda = SAY_CODA[emotion]?.[swipeKey];
  if (!coda) return baseSayText;
  const trimmed = baseSayText.replace(/[.!?]\s*$/, '');
  return `${trimmed}${coda}`;
}
