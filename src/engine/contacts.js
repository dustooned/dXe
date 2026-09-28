// Contacts — dial a friend. The Therapist is always in your phone; any NPC
// who trusts you (engine/trust.js) is added after their connection moment.
// A call gives their greeting, their read on whoever you're facing (the
// feeling is never named — its slice glows on the wheel), and advice from
// their own lens, which isn't always what the lake would want.
// PLACEHOLDER PROSE throughout.
import { isTrusted } from './trust.js';
import { ppmFor } from './lake.js';

// The Therapist reads your vitals off FEELZ: whichever reading is lowest
// gets a line (or the lake, when it's worse than all of them).
const HEALTH_LINES = {
  stability: [
    "Your battery's in the red. Sit down for a second before you answer anything.",
    "You're running on fumes. I can see it. Nothing has to be decided this second.",
  ],
  trust: [
    "Your bars are low. People aren't feeling you right now. One honest sentence can change that.",
    "Signal's weak. They don't know what to make of you yet.",
  ],
  lucidity: [
    "Your Wi-Fi's barely holding. You're not seeing this clearly. Slow down.",
    "You're foggy. Say less, notice more.",
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
  const readings = ['stability', 'trust', 'lucidity', 'integrity'].map((k) => [k, state[k] ?? 5]);
  const [worst, value] = readings.sort((a, b) => a[1] - b[1])[0];
  const debt = state.truthDebt ?? 0;
  let key = value <= 3 ? worst : 'steady';
  if (debt >= 6 && (key === 'steady' || debt - 5 > 3 - value)) key = 'lake';
  return pick(HEALTH_LINES[key]).replace('{ppm}', ppmFor(debt));
}

// Plain-language images for a mood, so a contact can describe it without
// naming the feeling.
const MOOD_IMAGES = {
  Happy: 'putting a bright face on something',
  Trust: 'more open than they usually let themselves be',
  Fear: 'scared, underneath it',
  Surprise: 'caught off guard',
  Sadness: 'carrying something heavy',
  Disgust: 'sick to their stomach about something',
  Anger: 'running hot',
  Anxiety: 'wound tight',
};

// bias: chance they tell you to lie. sight: how reliably they read a mood
// before your bond adds to it.
export const CONTACTS = {
  THERAPIST: {
    name: 'Therapist',
    bias: 0.25,
    sight: 0.85,
    greet: ["Hi. I've got a minute between clients.", "Hey. You called. That's good.", "I'm here. Talk to me."],
    read: 'From here it sounds like {who} is',
    truth: ["Tell them the true thing. Gently. It usually costs less than you think.", "Say what's real. Then let the silence do some work."],
    lie: ["Sometimes people need a soft landing first. That's allowed. Just don't live there."],
    tired: "And you sound tired. Go easy on yourself too.",
  },
  DEBORAH: {
    name: 'Deborah',
    bias: 0.65,
    sight: 0.55,
    greet: ["Oh honey, I was just thinking about you.", "Well, look who remembered my number.", "Bless you for calling. What's wrong?"],
    read: 'Oh, sugar. {who} is',
    truth: ["Tell them the truth. I wish somebody had told me sooner."],
    lie: ["Tell them what they need to hear. The Lord can sort out the rest.", "Be kind first. Honest can wait a day."],
    tired: "And you eat something today, you hear me?",
  },
  RWANDA: {
    name: 'Rwanda',
    bias: 0.2,
    sight: 0.6,
    greet: ["You actually called. Huh.", "Talk fast, I've got paint drying.", "What's up. And don't say nothing."],
    read: 'Okay. {who} is',
    truth: ["Don't sand it down for them. Say it straight.", "Tell them. People can handle more than you think if you don't flinch."],
    lie: ["Honestly? Let them have this one. Not every fight's yours."],
    tired: "Also you sound wrecked. Sit down somewhere.",
  },
  SAMUN: {
    name: 'Samun',
    bias: 0.55,
    sight: 0.6,
    greet: ["Yo yo yo, you calling ME? Somebody's having a day.", "Talk to me, talk to me.", "Ayy. What'd you do now?"],
    read: 'Real talk? {who} is',
    truth: ["Just say it, man. Four days taught me that much."],
    lie: ["Play along. People hate being fixed. Trust me.", "Tell 'em what goes down easy. Deal with the rest later."],
    tired: "And you gotta sleep, bro. I can hear it.",
  },
  RICK: {
    name: 'Rick',
    bias: 0.75,
    sight: 0.5,
    greet: ["Yeah.", "Make it quick.", "...You calling me? Alright. What."],
    read: "{who}? They're",
    truth: ["Fine. Say it. But say it like you mean it or don't bother."],
    lie: ["Lie. Everybody does. The ones who don't get eaten.", "Give 'em the story they want. Keeps you breathing."],
    tired: "And quit looking like you're about to fold.",
  },
};

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
export function callFor(contact, { state, currentName, mood }) {
  const c = CONTACTS[contact];
  const bond = state.bonds?.[contact];
  const reliability = Math.min(0.95, c.sight + ((bond?.syncs ?? 0) + (bond?.bids ?? 0)) * 0.08);
  const moods = Object.keys(MOOD_IMAGES);
  const read = mood && Math.random() < reliability ? mood : pick(moods.filter((m) => m !== mood));
  const lean = Math.random() < c.bias ? 'lie' : 'truth';
  const lines = [
    pick(c.greet),
    `${c.read.replace('{who}', currentName)} ${MOOD_IMAGES[read]}.`,
  ];
  // The Therapist always checks your vitals; friends only notice when
  // you're visibly running low.
  if (contact === 'THERAPIST') lines.push(healthLine(state));
  lines.push(pick(c[lean]));
  if (contact !== 'THERAPIST' && (state.stability ?? 10) <= 3) lines.push(c.tired);
  return { lines, read, lean };
}
