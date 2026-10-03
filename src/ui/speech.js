// Character dialogue is always in quotes. Content is authored that way;
// this covers speech that's generated in code (contact calls, the player's
// own line, a cutscene beat someone adds without quotes). Anything in ( )
// or [ ] stays outside the quotes as narration (ui/typewriterText.js).
const HAS_QUOTE = /["\u201c\u201d]/;

export function quoteSpeech(text) {
  if (!text || HAS_QUOTE.test(text)) return text;
  return text.split(/(\([^)]*\)|\[[^\]]*\])/).map((part) => {
    if (/^[([]/.test(part) || !part.trim()) return part;
    return part.replace(/^(\s*)([\s\S]*?)(\s*)$/, '$1"$2"$3');
  }).join('');
}
