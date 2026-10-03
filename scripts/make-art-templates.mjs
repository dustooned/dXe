#!/usr/bin/env node
// Generates the artist templates in art-templates/: one PNG per asset type,
// at the size to draw at (2x of the in-game size unless noted), with guide
// lines, safe zones and labels on a transparent background. Draw on a layer
// above the template, hide the template layer, export.
// See docs/ART_GUIDE.md for what each one is for.
//
// Usage: node scripts/make-art-templates.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'art-templates';
mkdirSync(OUT, { recursive: true });

const GUIDE = '#ff3fa4';
const SAFE = '#29b6ff';
const NOTE = '#ffd54a';
const FONT = 'font-family="monospace" font-weight="bold"';

function label(x, y, text, size = 22, color = NOTE, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" ${FONT}>${text}</text>`;
}
function frame(w, h, title, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${GUIDE}" stroke-width="2"/>
  ${inner}
  ${label(10, h - 12, `${title} · ${w}x${h}`, Math.max(12, Math.round(w / 40)))}
</svg>`;
}
async function make(file, w, h, title, inner) {
  await sharp(Buffer.from(frame(w, h, title, inner))).png().toFile(join(OUT, file));
  console.log(file);
}
const dashed = `stroke-dasharray="12 8"`;

// 1. Room background (mini-game walk), 2x of 390x844.
await make('room_bg_780x1688.png', 780, 1688, 'ROOM BG (2x) · 6 frames', `
  <rect x="0" y="0" width="780" height="96" fill="${GUIDE}" fill-opacity="0.18"/>
  ${label(20, 60, 'HUD STRIP · keep clear (skip / settings buttons)')}
  <rect x="32" y="128" width="716" height="1500" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  ${label(48, 170, 'SAFE AREA · objects + door go inside', 22, SAFE)}
  <line x1="390" y1="96" x2="390" y2="1688" stroke="${SAFE}" stroke-opacity="0.4" ${dashed}/>`);

// 2. Object close-up, 2x of 390x720.
await make('closeup_780x1440.png', 780, 1440, 'OBJECT CLOSE-UP (2x)', `
  <rect x="40" y="40" width="700" height="1360" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  ${label(56, 84, 'keep the object inside; a caption box covers the bottom 25%', 22, SAFE)}
  <rect x="0" y="1080" width="780" height="360" fill="${GUIDE}" fill-opacity="0.15"/>
  ${label(20, 1130, 'CAPTION ZONE · may be covered by text')}`);

// 3. Confrontation bust, 600x1200 (shown at 72% of canvas height).
await make('confront_bust_600x1200.png', 600, 1200, 'CONFRONT BUST', `
  <ellipse cx="300" cy="300" rx="150" ry="185" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  ${label(300, 120, 'HEAD', 26, SAFE, 'middle')}
  <line x1="0" y1="1196" x2="600" y2="1196" stroke="${GUIDE}" stroke-width="6"/>
  ${label(300, 1170, 'BOTTOM-ANCHORED · never bleed past this line', 22, GUIDE, 'middle')}
  ${label(14, 640, '← may bleed', 20)}${label(586, 640, 'may bleed →', 20, NOTE, 'end')}`);

// 4. Dialog portrait, 192x192 (shown at 96x96 inside a 3px border).
await make('portrait_192.png', 192, 192, 'PORTRAIT', `
  <rect x="8" y="8" width="176" height="176" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  <circle cx="96" cy="84" r="52" fill="none" stroke="${SAFE}" stroke-opacity="0.6" stroke-width="2" ${dashed}/>
  ${label(96, 182, 'face here · border eats 6px', 11, SAFE, 'middle')}`);

// 5. Ending story slide, 4:3, 2x of the ~350px frame.
await make('ending_slide_800x600.png', 800, 600, 'ENDING SLIDE (4:3)', `
  <rect x="24" y="40" width="752" height="520" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  <rect x="0" y="0" width="300" height="34" fill="${GUIDE}" fill-opacity="0.18"/>
  ${label(10, 24, 'tag corner (ending · n)', 18)}
  ${label(400, 320, 'one image per ending line (endings.json images[])', 22, SAFE, 'middle')}`);

// 6. Panning panorama frame (title + chapter banners). Script makes it seamless.
await make('panorama_frame_1280x576.png', 1280, 576, 'PANORAMA FRAME · title / chapter banner', `
  <rect x="1000" y="0" width="280" height="576" fill="${GUIDE}" fill-opacity="0.18"/>
  ${label(1010, 40, 'BLEND ZONE', 20)}
  ${label(1010, 66, 'right 22%: fades', 18)}
  ${label(1010, 90, 'into the LEFT EDGE.', 18)}
  ${label(1010, 114, 'Keep it continuous', 18)}
  ${label(1010, 138, 'with x = 0.', 18)}
  <rect x="0" y="0" width="280" height="576" fill="${SAFE}" fill-opacity="0.12"/>
  ${label(14, 40, 'LEFT EDGE', 20, SAFE)}
  ${label(640, 300, 'wide landscape · 1-bit dither or 2-4 colors · draw every frame the same size', 22, SAFE, 'middle')}`);

// 7. Title logo, transparent, ~2x of the 640x280 sheet frame.
await make('title_logo_1280x560.png', 1280, 560, 'TITLE LOGO (transparent)', `
  <line x1="0" y1="280" x2="1280" y2="280" stroke="${GUIDE}" stroke-width="3" ${dashed}/>
  ${label(20, 270, 'SPLIT LINE · top half slides in from the left, bottom from the right', 22, GUIDE)}
  <rect x="64" y="40" width="1152" height="480" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  ${label(80, 80, 'SAFE AREA', 22, SAFE)}`);

// 8. Feeling icon, 9x9 pixels, shown at 16x for drawing.
{
  let grid = '';
  for (let i = 0; i <= 9; i++) {
    grid += `<line x1="${i * 16}" y1="0" x2="${i * 16}" y2="144" stroke="${SAFE}" stroke-opacity="0.6"/>`;
    grid += `<line x1="0" y1="${i * 16}" x2="144" y2="${i * 16}" stroke="${SAFE}" stroke-opacity="0.6"/>`;
  }
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144">${grid}</svg>`)).png().toFile(join(OUT, 'feeling_icon_9x9_at16x.png'));
  console.log('feeling_icon_9x9_at16x.png');
}

// 9. IT/SO icon, 32x32, shown at 16x.
{
  let grid = '';
  for (let i = 0; i <= 32; i++) {
    grid += `<line x1="${i * 16}" y1="0" x2="${i * 16}" y2="512" stroke="${SAFE}" stroke-opacity="${i % 8 ? 0.25 : 0.7}"/>`;
    grid += `<line x1="0" y1="${i * 16}" x2="512" y2="${i * 16}" stroke="${SAFE}" stroke-opacity="${i % 8 ? 0.25 : 0.7}"/>`;
  }
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${grid}</svg>`)).png().toFile(join(OUT, 'it_icon_32x32_at16x.png'));
  console.log('it_icon_32x32_at16x.png');
}

// 10. Pastor Gabriel bust (reckoning), 5:4.
await make('pastor_bust_480x384.png', 480, 384, 'PASTOR BUST (5:4)', `
  <ellipse cx="240" cy="150" rx="70" ry="86" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  <ellipse cx="240" cy="56" rx="80" ry="16" fill="none" stroke="${NOTE}" stroke-width="2" ${dashed}/>
  ${label(240, 30, 'halo', 16, NOTE, 'middle')}
  ${label(18, 300, 'wings / shoulders fill the lower half', 16, SAFE)}`);

// 11. Cutscene symbol (Bob Baiter's announcements), square frames.
await make('symbol_384x384.png', 384, 384, 'CUTSCENE SYMBOL · frames', `
  <rect x="32" y="32" width="320" height="320" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>
  ${label(192, 200, 'centered over the speaker', 16, SAFE, 'middle')}`);

// 12. Cutscene speaker sprite (Bob Baiter style), square.
await make('speaker_sprite_600x600.png', 600, 600, 'CUTSCENE SPEAKER', `
  <line x1="0" y1="596" x2="600" y2="596" stroke="${GUIDE}" stroke-width="6"/>
  ${label(300, 580, 'bottom-anchored', 20, GUIDE, 'middle')}
  <ellipse cx="300" cy="200" rx="110" ry="130" fill="none" stroke="${SAFE}" stroke-width="2" ${dashed}/>`);
