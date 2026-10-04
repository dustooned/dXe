// Contacts — dial a friend. The Therapist is always in your phone; any NPC
// who trusts you (engine/trust.js) is added after their connection moment.
// A call gives their greeting, their read on whoever you're facing (the
// feeling is never named — its slice glows on the wheel), and advice from
// their own lens, which isn't always what the lake would want.
//
// Each call is shaped by three things, so no two play the same:
//   afterLast  how you left the last person (connected, pushed away, or it
//              was them): run.lastParting, set by dialogScene at an
//              encounter's end. {who} is that person's name.
//   knows      their history with whoever you're facing now, carrying the
//              read: {feel} becomes the colored image of the mood they see.
//   byClass    a tip aimed at your class's habit (Guns braces, Bible holds on
//              to the right words, Crystals absorbs everything).
//   moods      how they put each feeling into words — their own voice, never
//              the feeling's name.
// Low Wi-Fi (Lucidity under FOG_WIFI: every lie fogs it) quietly costs the
// call its clarity, the same line that silences the Therapist and FEELZ tips:
// the read comes through uncolored, the wheel doesn't light, and the friend
// says something that shows your story is getting hard to follow (foggy).
// PLACEHOLDER PROSE throughout (first drafts, for the writer).
import { isTrusted } from './trust.js';
import { ppmFor } from './lake.js';

// The Therapist reads your vitals off FEELZ: whichever reading is lowest
// gets a line (or the lake, when it's worse than all of them).
const HEALTH_LINES = {
  stability: [
    "Your battery's in the red. Sit down for a second before you answer anything.",
    "You're running on fumes. I can see it. Nothing has to be decided this second.",
  ],
  // Bars and Wi-Fi: he only picks up at 4 or more, so these are for exactly
  // 4, one step from the call not connecting at all.
  trust: [
    "Your bars are one notch from me not getting through. People aren't feeling you right now. One honest sentence can change that.",
    "Signal's weak. One more step down and this call doesn't connect.",
  ],
  lucidity: [
    "Your Wi-Fi's barely holding. One more lie and this call doesn't connect. Slow down.",
    "You're foggy. Say less, notice more. I'd like to keep hearing from you.",
  ],
  integrity: [
    "Your clock's slipping. You know what that means.",
    "The time on your phone is wrong again. That's not the phone.",
  ],
  lake: [
    "And the lake's reading {ppm} ppm. I can see it from here.",
    "The lake's at {ppm}. Every one of those is something you said.",
  ],
  steady: [
    "Your readings look steady. That's rare. Use it.",
    "Everything's holding. Good. Don't spend it all in one conversation.",
  ],
};

function healthLine(state) {
  // Low is 3 or below, except bars and Wi-Fi: he can't be reached under 4,
  // so for those, 4 is the warning. The lowest low reading gets the line.
  const low = (k, v) => v <= (k === 'trust' || k === 'lucidity' ? 4 : 3);
  const readings = ['stability', 'trust', 'lucidity', 'integrity'].map((k) => [k, state[k] ?? 5]);
  const [worst, value] = readings.filter(([k, v]) => low(k, v)).sort((a, b) => a[1] - b[1])[0] ?? ['steady', 5];
  const debt = state.truthDebt ?? 0;
  let key = worst;
  if (debt >= 6 && (key === 'steady' || debt - 5 > 3 - value)) key = 'lake';
  return pick(HEALTH_LINES[key]).replace('{ppm}', ppmFor(debt));
}

// The feelings a contact can read (each contact words them in `moods`).
const MOODS = ['Happy', 'Trust', 'Fear', 'Surprise', 'Sadness', 'Disgust', 'Anger', 'Anxiety'];

// Below this Wi-Fi, calls lose their color (one fog rule for the whole phone:
// the Therapist won't pick up and FEELZ tips go quiet at the same line).
export const FOG_WIFI = 4;

// bias: chance they tell you to lie. sight: how reliably they read a mood
// before your bond adds to it. dominant: the feeling they live in — their
// color in the dock and on calls, and what they see in people when they
// misread them (Deborah sees grief everywhere). The Therapist has none:
// clinical grey, and his misreads are just noise.
export const CONTACTS = {
  THERAPIST: {
    name: 'Therapist',
    dominant: null,
    bias: 0.25,
    sight: 0.85,
    greet: ["Hi. I've got a minute between clients.", "Hey. You called. That's good.", "I'm here. Talk to me."],
    read: 'From here it sounds like {who} is',
    truth: ["Tell them the true thing. Gently. It usually costs less than you think.", "Say what's real. Then let the silence do some work."],
    lie: ["Sometimes people need a soft landing first. That's allowed. Just don't live there."],
    tired: "And you sound tired. Go easy on yourself too.",
    foggy: "You sound far away. Like you're answering me from underwater.",
    moods: {
      Happy: 'performing fine. Watch the gap between the smile and the eyes',
      Trust: 'letting a little more in than usual',
      Fear: 'scared, and managing it',
      Surprise: "thrown. Something didn't go the way it was rehearsed",
      Sadness: "carrying a weight that hasn't been set down in years",
      Disgust: 'repelled by something. Maybe by themselves',
      Anger: 'holding a lot of heat behind the eyes',
      Anxiety: 'braced for the next thing to go wrong',
    },
    afterLast: {
      connected: "I saw {who}'s number go into your phone. FEELZ tells me things. Good.",
      pushed: "{who} showed you out? That happens. Doors close. Most of them aren't locked.",
    },
    knows: {
      DEBORAH: 'Deborah came to my Tuesday group twice and organized the snacks both times. Right now she\'s {feel}.',
      RWANDA: "Rwanda doesn't do groups. She does walls. Right now she's {feel}.",
      SAMUN: "Samun makes everybody laugh so nobody looks at him. Right now he's {feel}.",
      RICK: "Rick's not on my caseload. He should be. Right now he's {feel}.",
    },
    byClass: {
      Guns: "You're bracing again. I can hear it. Unclench your jaw before you answer.",
      Bible: "You don't need the right words. You need your words.",
      Crystals: "You're carrying their weather. Set it down for one answer and see what's yours.",
    },
  },
  DEBORAH: {
    name: 'Deborah',
    dominant: 'Sadness',
    bias: 0.65,
    sight: 0.55,
    greet: ["Oh honey, I was just thinking about you.", "Well, look who remembered my number.", "Bless you for calling. What's wrong?"],
    read: 'Oh, sugar. {who} is',
    truth: ["Tell them the truth. I wish somebody had told me sooner."],
    lie: ["Tell them what they need to hear. The Lord can sort out the rest.", "Be kind first. Honest can wait a day."],
    tired: "And you eat something today, you hear me?",
    foggy: "Honey, you told me that already, didn't you? Or was it something else...",
    moods: {
      Happy: "smiling like it's Sunday and the casserole came out right",
      Trust: "softening, sugar. Don't you waste it",
      Fear: 'scared as a cat in a thunderstorm',
      Surprise: 'all flustered, like somebody moved the furniture',
      Sadness: 'grieving something. I know that look, I wear it',
      Disgust: 'gone sour, like milk left out',
      Anger: 'fit to be tied',
      Anxiety: "wringing a dish towel that isn't there",
    },
    afterLast: {
      connected: "Oh, I heard about you and {who}. This town talks, honey. That's a good thing, for once.",
      pushed: "{who} sent you off? Oh, sugar. Some folks have to push before they can pull.",
      me: "You're calling already? Well, I'm not complaining.",
    },
    knows: {
      RWANDA: 'Rwanda painted the mural on the fellowship hall and they made her paint over it. Right now she\'s {feel}.',
      SAMUN: "Samun carried my groceries last winter and wouldn't take a dime. Right now he's {feel}.",
      RICK: "Rick's mother sat two pews up from me for twenty years. Right now he's {feel}.",
    },
    byClass: {
      Guns: 'And put your fists in your pockets, baby. Nobody opens up to a clenched hand.',
      Bible: "And don't quote at them. The Lord didn't need footnotes and neither do you.",
      Crystals: "And don't soak up all their hurt like a dish towel. You'll wring yourself out.",
    },
  },
  RWANDA: {
    name: 'Rwanda',
    dominant: 'Anxiety',
    bias: 0.2,
    sight: 0.6,
    greet: ["You actually called. Huh.", "Talk fast, I've got paint drying.", "What's up. And don't say nothing."],
    read: 'Okay. {who} is',
    truth: ["Don't sand it down for them. Say it straight.", "Tell them. People can handle more than you think if you don't flinch."],
    lie: ["Honestly? Let them have this one. Not every fight's yours."],
    tired: "Also you sound wrecked. Sit down somewhere.",
    foggy: "Your story keeps changing colors. I can't get a read on you, let alone them.",
    moods: {
      Happy: 'too bright. Like a fresh coat over water damage',
      Trust: "in warmer tones. Don't make me say it twice",
      Fear: 'cold blue at the edges',
      Surprise: 'a splash nobody planned',
      Sadness: 'all grey wash, no highlights',
      Disgust: 'a color that went muddy',
      Anger: 'red. Cadmium red',
      Anxiety: 'all tight little brushstrokes',
    },
    afterLast: {
      connected: "So {who} let you in. Huh. Maybe you're less trouble than you look.",
      pushed: "{who} showed you the door? Yeah. Nobody likes being looked at that close.",
      me: "Calling me already? Don't make it weird.",
    },
    knows: {
      SAMUN: 'Samun let me paint the back wall of the bar, then hung a dartboard on it. Right now he\'s {feel}.',
      RICK: "Rick had me paint his tank once. Paid cash, wouldn't look at it. Right now he's {feel}. That's the coat, though, not the guy.",
    },
    byClass: {
      Guns: "And quit squaring up. You look like you're waiting to get punched.",
      Bible: 'And put the verses down a minute. Say it in your own words. People can smell a sermon.',
      Crystals: 'And stop mirroring them. Have your own face for once.',
    },
  },
  SAMUN: {
    name: 'Samun',
    dominant: 'Happy',
    bias: 0.55,
    sight: 0.6,
    greet: ["Yo yo yo, you calling ME? Somebody's having a day.", "Talk to me, talk to me.", "Ayy. What'd you do now?"],
    read: 'Real talk? {who} is',
    truth: ["Just say it, man. Four days taught me that much."],
    lie: ["Play along. People hate being fixed. Trust me.", "Tell 'em what goes down easy. Deal with the rest later."],
    tired: "And you gotta sleep, bro. I can hear it.",
    foggy: "Bro, you're telling me stuff I'm pretty sure you made up. It's cool. It's cool.",
    moods: {
      Happy: 'doing the smile thing. I invented the smile thing',
      Trust: "kinda letting you in. Don't make it weird",
      Fear: 'spooked. Laughing a little too fast',
      Surprise: 'like somebody switched the playlist mid-song',
      Sadness: 'last-call sad. Lights on, nobody leaving',
      Disgust: 'making the face I make at well vodka',
      Anger: 'one bad joke away from flipping a table',
      Anxiety: 'checking the door every five seconds',
    },
    afterLast: {
      connected: 'Yo, word is you and {who} are tight now. Look at you, making friends.',
      pushed: '{who} kicked you out? Ha. Join the club, we got jackets.',
      me: 'Missed me already? Understandable.',
    },
    knows: {
      RICK: "Rick drinks at my bar, tips in quarters, never says thanks. Right now he's {feel}.",
    },
    byClass: {
      Guns: "And unclench, man. You walk in everywhere like it's a raid.",
      Bible: "And don't try to save 'em. Just hang out. Saving's exhausting for everybody.",
      Crystals: "And don't laugh at their jokes if they ain't funny. I can tell. So can they.",
    },
  },
  RICK: {
    name: 'Rick',
    dominant: 'Anger',
    bias: 0.75,
    sight: 0.5,
    greet: ["Yeah.", "Make it quick.", "...You calling me? Alright. What."],
    read: "{who}? They're",
    truth: ["Fine. Say it. But say it like you mean it or don't bother."],
    lie: ["Lie. Everybody does. The ones who don't get eaten.", "Give 'em the story they want. Keeps you breathing."],
    tired: "And quit looking like you're about to fold.",
    foggy: "You sound like a guy I used to be. I didn't trust him either.",
    moods: {
      Happy: "grinning. Don't trust it",
      Trust: "not swinging. That's something",
      Fear: 'spooked. Hides it worse than me',
      Surprise: 'blindsided',
      Sadness: "sunk. Don't poke it",
      Disgust: 'sick of all of it. Join the club',
      Anger: 'pissed. I know pissed',
      Anxiety: 'twitchy. Keeps a hand near the door',
    },
    afterLast: {
      connected: "Heard {who} gave you the time of day. Don't let it go to your head.",
      pushed: '{who} cut you loose. Happens. Get back on the bike.',
      me: '...You again. Fine.',
    },
    knows: {},
    byClass: {
      Guns: "And don't swing first. Swing second. Swing never, if you can.",
      Bible: "And skip the scripture. I've had enough of it held over my head.",
      Crystals: "And quit feeling sorry for people. They can tell. It's an insult.",
    },
  },
};

// When he won't pick up: his voicemail greeting, which (being him) says
// exactly why. Keyed by what's too low: bars, Wi-Fi, or both.
const VOICEMAIL = {
  trust: [
    "Hi, you've reached the Therapist. If you're hearing this, your bars are too low to get through. That's not a judgment. It's signal strength. Get to four and try me again.",
    "*beep*",
  ],
  lucidity: [
    "Hi, you've reached the Therapist. If you're hearing this, your Wi-Fi's too foggy to connect. Tell someone one true thing, then call back. Or don't. I'm not your mom.",
    "*beep*",
  ],
  both: [
    "Hi, you've reached the Therapist. I'm not available right now. Statistically I'm in a session, or eating lunch over my keyboard. Bars and Wi-Fi, four or more, then call back.",
    "Please don't leave a message. My inbox is at capacity. I'm working on it. I'm not working on it.",
    "*beep*",
  ],
};
export function voicemailFor(state) {
  const lowBars = (state.trust ?? 0) < 4;
  const lowWifi = (state.lucidity ?? 0) < 4;
  return VOICEMAIL[lowBars && lowWifi ? 'both' : lowBars ? 'trust' : 'lucidity'];
}

// The Therapist picks up only when the phone has something to work with:
// enough bars (Trust) and enough Wi-Fi (Lucidity).
export function therapistReachable(state) {
  return (state.trust ?? 0) >= 4 && (state.lucidity ?? 0) >= 4;
}

// Contacts shown while facing `current` (never the person you're facing).
export function contactsFor(state, current) {
  const people = Object.entries(state.bonds ?? {})
    .filter(([npc, entry]) => npc !== current && isTrusted(entry) && CONTACTS[npc])
    .map(([npc]) => npc);
  return current === 'THERAPIST' ? people : ['THERAPIST', ...people];
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// One call's content. `mood` is the NPC's real mood right now; the contact
// reads it correctly more often the stronger your bond with them.
export function callFor(contact, { state, currentName, currentKey, mood }) {
  const c = CONTACTS[contact];
  const bond = state.bonds?.[contact];
  const reliability = Math.min(0.95, c.sight + ((bond?.syncs ?? 0) + (bond?.bids ?? 0)) * 0.08);
  // A misread is their own feeling, projected (unless that's the real
  // mood, or they have none: then any wrong one).
  const misread = c.dominant && c.dominant !== mood ? c.dominant : pick(MOODS.filter((m) => m !== mood));
  const read = mood && Math.random() < reliability ? mood : misread;
  const lean = Math.random() < c.bias ? 'lie' : 'truth';
  // How you left the last person: them (they just gave you their number),
  // someone you connected with, or someone who showed you out.
  const last = state.lastParting;
  const lastName = last && (CONTACTS[last.npc]?.name ?? last.npc);
  const greet = !last ? null
    : last.npc === contact ? c.afterLast?.me
    : c.afterLast?.[last.outcome]?.replace('{who}', lastName);
  // The image is colored the feeling it describes, matching the slice that
  // glows on the wheel; their history with this person frames it if they have
  // one. In deep water it comes through uncolored and the wheel stays dark.
  const fogged = (state.lucidity ?? 5) < FOG_WIFI;
  const words = c.moods[read];
  const image = fogged ? words : `{color:${read}}${words}{/color}`;
  const knows = c.knows?.[currentKey];
  const lines = [
    greet ?? pick(c.greet),
    knows ? knows.replace('{feel}', image) : `${c.read.replace('{who}', currentName)} ${image}.`,
  ];
  // The Therapist always checks your vitals; friends only notice when
  // you're visibly running low.
  if (contact === 'THERAPIST') lines.push(healthLine(state));
  lines.push(pick(c[lean]));
  const tip = c.byClass?.[state.loadout];
  if (tip) lines.push(tip);
  if (fogged) lines.push(c.foggy);
  if (contact !== 'THERAPIST' && (state.stability ?? 10) <= 3) lines.push(c.tired);
  return { lines, read, lean, fogged };
}
