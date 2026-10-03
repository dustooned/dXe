// Composes the text shown after a swipe: the node's authored npcReaction plus
// one short coda drawn from a per-NPC table, keyed by the FEELZ emotion the
// player picked and by which side they swiped.
//
// One table per NPC — each voiced in that character's own imagery (Deborah's
// kitchen and bible, Rick's bar and patch, Rwanda's window and cigarette,
// Samun's rag and bottles, the Therapist's phone line) rather than one
// generic table shared by everyone. A shared table used to mean the exact
// same sentence could follow a swipe with Deborah grieving her son and a
// swipe with Rick threatening you about his patch — same words, unrelated
// scenes. `DEFAULT` is what a future NPC gets until they have their own.
//
// The codas describe *delivery* — how the line left you, how it sat in the
// room — never whether the choice was right. Same rule the fx intensity
// follows: weight, not verdict.
//
// PLACEHOLDER PROSE. The table shape is the design; the lines exist to cover
// all 16 combinations per NPC, not as final writing.

const DEFAULT = {
  Happy: {
    truth: 'It came out lighter than the thing deserved.',
    lie: 'You enjoyed how easy that was. You notice yourself enjoying it.',
  },
  Trust: {
    truth: 'You handed it over whole, without checking who was holding it.',
    lie: 'You said it the way you say things to people who believe you.',
  },
  Fear: {
    truth: 'You got it out before you could take it back.',
    lie: 'You heard the safer version leave your mouth and let it go.',
  },
  Surprise: {
    truth: "You weren't planning to say that. It was already said.",
    lie: 'The lie arrived fully built, and you had no memory of building it.',
  },
  Sadness: {
    truth: 'Quieter than you meant. It landed anyway.',
    lie: "You said it gently, which somehow made it worse.",
  },
  Disgust: {
    truth: 'You could taste it on the way out.',
    lie: 'Something in you turned away while your mouth kept going.',
  },
  Anger: {
    truth: 'Harder than you meant it. You do not take it back.',
    lie: 'You put an edge on it so nobody would look too closely.',
  },
  Anxiety: {
    truth: 'You were already braced for what comes after.',
    lie: 'You were three moves ahead before the sentence finished.',
  },
};

// Kitchen, bible, coffee neither of them drinks, Caleb's name. Deborah's
// scenes stay domestic and quiet even when what's said isn't.
const DEBORAH = {
  Happy: {
    truth: 'It came out clean, in a house that doesn’t usually allow that.',
    lie: 'The lie went down easy as the coffee neither of you touch — warm, and gone before it could matter.',
  },
  Trust: {
    truth: 'You handed her the plain version and let her decide what to do with it.',
    lie: 'You said it the way you’d say something to someone who’d already decided to believe you.',
  },
  Fear: {
    truth: 'You got it out before the kitchen could talk you out of it.',
    lie: 'You heard the softer version leave you and let the bible stay shut on the table.',
  },
  Surprise: {
    truth: 'You didn’t plan to say that at her table. It came out anyway.',
    lie: 'The lie arrived fully formed, like it had been sitting in the pot the whole time.',
  },
  Sadness: {
    truth: 'Quieter than you meant, in a house that’s already gone quiet.',
    lie: 'You said it gently. Gentle made it worse, same as it always does in that kitchen.',
  },
  Disgust: {
    truth: 'You could taste it going out, bitter as coffee nobody’s going to drink.',
    lie: 'Something in you turned away while the rest of you kept sitting at her table.',
  },
  Anger: {
    truth: 'Harder than you meant it, in a room built for softer voices than that.',
    lie: 'You put an edge on it so the silence after wouldn’t ask you anything.',
  },
  Anxiety: {
    truth: 'You were already braced before her hand found the bible again.',
    lie: 'You knew exactly which words would keep her hand off the cover, and used them.',
  },
};

// Bar, patch, knuckles, the performance that cracks and reseals. Rick's
// scenes stay physical — hands, jaw, sleeve — even in the quiet ones.
const RICK = {
  Happy: {
    truth: 'It came out easy, and for once he didn’t read that as weakness.',
    lie: 'You said it like a toast. He drank to it like one too.',
  },
  Trust: {
    truth: 'You gave it to him straight, the one thing he can’t stand being handled with gloves.',
    lie: 'You said it the way you talk to a man who’ll remember exactly how you said it.',
  },
  Fear: {
    truth: 'You got it out before his jaw could set again.',
    lie: 'You heard the safer version leave you and watched his shoulders drop with it.',
  },
  Surprise: {
    truth: 'You didn’t mean to say that at his bar. It was already out, sitting between the glasses.',
    lie: 'The lie came out smooth as the patch story he tells everyone — rehearsed, and he never noticed the seam.',
  },
  Sadness: {
    truth: 'Quiet, for a room that runs on noise. He heard it anyway.',
    lie: 'You said it soft, and soft is the one thing that gets past him.',
  },
  Disgust: {
    truth: 'You said it and watched him decide whether to hit something or laugh.',
    lie: 'You kept your face flat while the rest of you wanted no part of the room.',
  },
  Anger: {
    truth: 'Harder than you meant it, and for a second his jaw matched yours.',
    lie: 'You put an edge on it because a flat answer would’ve gotten you a worse one back.',
  },
  Anxiety: {
    truth: 'You were already reading which way his hand would move before you finished the sentence.',
    lie: 'You were already three moves past whatever he was about to do about it.',
  },
};

// Window, cigarette she doesn't smoke, flinching before anyone's said
// anything. Rwanda's scenes track the exact moment guardedness lifts.
const RWANDA = {
  Happy: {
    truth: 'It came out light, and she let herself take it that way, just for a second.',
    lie: 'It came out smooth as the version she’s used to hearing — easy, and just as hollow.',
  },
  Trust: {
    truth: 'You handed it over plain, no performance in it for her to brace against.',
    lie: 'You said it the way people say things right before they ask her to be smaller.',
  },
  Fear: {
    truth: 'You got it out before she could brace for the version you didn’t say.',
    lie: 'You heard the safer answer leave you and watched her go back to the window.',
  },
  Surprise: {
    truth: 'You didn’t plan to say that. Neither did she expect it — you both noticed that at the same time.',
    lie: 'The lie came out sounding just like the last one she heard tonight. She clocked it instantly.',
  },
  Sadness: {
    truth: 'Quieter than you meant, and she went still the way she does when something’s actually landed.',
    lie: 'You said it gently. Gentle is exactly the tone she’s learned not to trust.',
  },
  Disgust: {
    truth: 'You let it show on your face instead of smoothing it into something digestible.',
    lie: 'You kept your face polite while something in you refused to sit still.',
  },
  Anger: {
    truth: 'Harder than you meant, and for once it wasn’t aimed at her having to explain herself.',
    lie: 'You put an edge on it so she wouldn’t hear how unsure you actually were.',
  },
  Anxiety: {
    truth: 'You were already bracing for the flinch before you’d even finished the sentence.',
    lie: 'You were already rehearsing her reaction before she’d had a chance to have one.',
  },
};

// Rag, unopened bottles, the brother who calls on day five. Samun's scenes
// stay circular — the same room, the same counter, further in each time.
const SAMUN = {
  Happy: {
    truth: 'It came out light. Lighter than anything gets in that garage lately.',
    lie: 'It went down easy as the first one always does. That’s the whole problem with easy.',
  },
  Trust: {
    truth: 'You gave it to him straight and let him do what he wants with it, same as always.',
    lie: 'You said it the way you say things to someone who’s decided in advance to agree with you.',
  },
  Fear: {
    truth: 'You got it out before he could reach for the rag again.',
    lie: 'You heard the safer version leave you and watched him relax into it like a chair.',
  },
  Surprise: {
    truth: 'You didn’t plan to say that over his counter. It came out anyway, and he actually looked up.',
    lie: 'The lie came out sounding exactly like something he’d tell himself. He didn’t even blink.',
  },
  Sadness: {
    truth: 'Quiet, for a garage that runs on deflection. It got through anyway.',
    lie: 'You said it soft, and soft is what let him agree without hearing it.',
  },
  Disgust: {
    truth: 'You let it show instead of dressing it up as something he could stand to hear.',
    lie: 'You kept your face even while the rest of you wanted to leave the garage.',
  },
  Anger: {
    truth: 'Harder than you meant, in a room that’s built to absorb exactly that and keep going.',
    lie: 'You put an edge on it so it would sound like conviction instead of the guess it was.',
  },
  Anxiety: {
    truth: 'You already knew which bottle he’d reach for before you finished talking.',
    lie: 'You were already rehearsing how he’d spin it back to you before he even started.',
  },
};

// One node, a phone line, a chart clicking open somewhere on his end.
// Therapist's coda set stays this short and quiet on purpose — there's
// only ever one exchange to color.
const THERAPIST = {
  Happy: {
    truth: 'It came out lighter than you expected, into a line that’s heard heavier.',
    lie: 'It went down easy — easy enough that he didn’t reach for the chart at all.',
  },
  Trust: {
    truth: 'You gave him the real version and let him hold it, the way his job asks people to.',
    lie: 'You said it the way you say something to someone paid to believe you either way.',
  },
  Fear: {
    truth: 'You got it out before the silence on his end could ask you to try again.',
    lie: 'You heard the smaller version leave you, and heard him not push past it.',
  },
  Surprise: {
    truth: 'You didn’t mean to say that much. It was already out before the next question came.',
    lie: 'The lie came out smooth as every short version he’s ever been handed on this line.',
  },
  Sadness: {
    truth: 'Quiet, the way things get right before you say the true one.',
    lie: 'You said it gently, and he let the gentleness stand in for an answer.',
  },
  Disgust: {
    truth: 'You said it plainly and let the discomfort be his to sit with, not yours to manage.',
    lie: 'You kept your voice even while the rest of you wanted the call to end.',
  },
  Anger: {
    truth: 'Harder than you meant, down a phone line built for softer things.',
    lie: 'You put an edge on it so the pause after wouldn’t turn into a real question.',
  },
  Anxiety: {
    truth: 'You were already bracing for his next question before you’d finished this answer.',
    lie: 'You knew which answer would end the call fastest, and gave him that one.',
  },
};

const CODAS = { DEBORAH, RICK, RWANDA, SAMUN, THERAPIST, DEFAULT };

// The same delivery, told through the player's class: how Guns, Bible and
// Crystals each notice how a line left them (the lenses of the body lines,
// ui/feelingIcons.js): force and bracing; conscience and confession; energy
// moving through. Delivery only, never a verdict. PLACEHOLDER PROSE.
const CLASS_CODAS = {
  Guns: {
    Happy: { truth: 'It came out loose and easy, no recoil at all.', lie: 'Easy. Too easy. You checked the exits anyway.' },
    Trust: { truth: 'You lowered your guard and said it straight.', lie: 'You said it like someone who’d cover them. Your hand never left your pocket.' },
    Fear: { truth: 'You got it out before the flinch could stop it.', lie: 'You took the safe line and kept your back to the wall.' },
    Surprise: { truth: 'It went off before you’d aimed it.', lie: 'The lie cleared leather before you decided to draw.' },
    Sadness: { truth: 'It came out slow, like setting something heavy down.', lie: 'You kept it light so nobody would clock the weight.' },
    Disgust: { truth: 'You spat it out and didn’t wipe your mouth.', lie: 'Your jaw locked while the easy words went out.' },
    Anger: { truth: 'It hit harder than you aimed. You let it.', lie: 'You put force behind it so nobody would check what was underneath.' },
    Anxiety: { truth: 'You said it with one eye on the door.', lie: 'You had three ways out before the sentence ended.' },
  },
  Bible: {
    Happy: { truth: 'It came out like a small grace, plain and unearned.', lie: 'It went down sweet, and something in you kept count.' },
    Trust: { truth: 'You laid it down open-handed, like an offering.', lie: 'You said it the way a promise sounds. You heard the difference.' },
    Fear: { truth: 'You said it the way people confess: fast, eyes down.', lie: 'You chose the safe words and felt them settle like a debt.' },
    Surprise: { truth: 'It slipped out like a prayer you didn’t mean to say aloud.', lie: 'The lie came so easily it frightened you a little.' },
    Sadness: { truth: 'Quiet, like something said at a graveside.', lie: 'You said it softly, and it sat on your chest anyway.' },
    Disgust: { truth: 'It tasted bitter, and you said it anyway.', lie: 'Something in you stepped back from your own voice.' },
    Anger: { truth: 'It came out like a verdict. You let it stand.', lie: 'Righteous on the outside. You knew what was under it.' },
    Anxiety: { truth: 'You said it and started rehearsing how it sounded.', lie: 'You’d already written the apology in your head.' },
  },
  Crystals: {
    Happy: { truth: 'It came out bright, and the room took it in.', lie: 'It sparkled on the way out and held no charge.' },
    Trust: { truth: 'You let it flow straight through you, no filter.', lie: 'You matched their frequency perfectly. It wasn’t your note.' },
    Fear: { truth: 'You pushed it out through the cold in your arms.', lie: 'You pulled your energy in tight and let the safe thing out.' },
    Surprise: { truth: 'It came through you before you knew it was there.', lie: 'The lie lit up and was gone before you felt it leave.' },
    Sadness: { truth: 'It came out low, and the air got heavier with it.', lie: 'You smoothed it over and felt the weight sink lower.' },
    Disgust: { truth: 'It left a film on your tongue, and you let it.', lie: 'Your skin crawled while your voice stayed sweet.' },
    Anger: { truth: 'Heat went out with it. The room felt it.', lie: 'You ran hot on the surface so nothing deeper showed.' },
    Anxiety: { truth: 'You said it with your whole body buzzing.', lie: 'You were already picking up the fallout before it landed.' },
  },
};

// Variety: each time a feeling and side come up, the coda alternates
// between the NPC's own line (their imagery) and the class's line (your
// lens), so the same pick doesn't close the same way twice in a row. The
// first time it's a coin flip.
const lastSource = new Map();

export function reactionCoda(npcKey, emotion, swipeKey, loadout) {
  const npcLine = (CODAS[npcKey] ?? DEFAULT)[emotion]?.[swipeKey] ?? null;
  const classLine = CLASS_CODAS[loadout]?.[emotion]?.[swipeKey] ?? null;
  if (!npcLine || !classLine) return npcLine ?? classLine;
  const key = `${npcKey}|${emotion}|${swipeKey}`;
  const prev = lastSource.get(key);
  const useClass = prev === undefined ? Math.random() < 0.5 : prev === 'npc';
  lastSource.set(key, useClass ? 'class' : 'npc');
  return useClass ? classLine : npcLine;
}

// Falls back to the authored line alone when no emotion was in play, so a
// scene that doesn't use the dartboard reads exactly as it did before.
export function composeReaction(npcKey, npcReaction, emotion, swipeKey, loadout) {
  const coda = reactionCoda(npcKey, emotion, swipeKey, loadout);
  return coda ? `${npcReaction}\n\n${coda}` : npcReaction;
}
