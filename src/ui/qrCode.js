// A QR code of a run link (engine/runCode.js), drawn as hard pixels: dark
// modules on white paper with the standard quiet zone, which every phone
// camera reads (an inverted white-on-black QR fails on some). The encoder is
// qrcode-generator (MIT); this only lays out the modules.
import qrcode from 'qrcode-generator';

const QUIET = 4; // modules of white border, per the QR spec

// The module grid for `text`: { size, dark(r, c) }. Error correction L (the
// most room for data; the code has its own checksum on top).
export function qrModules(text) {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

// Paint it into a 2D context at (x, y), `px` pixels per module, quiet zone
// included. Returns the side length drawn.
export function drawQr(ctx, text, x, y, px) {
  const { size, dark } = qrModules(text);
  const side = (size + QUIET * 2) * px;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, side, side);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (dark(r, c)) ctx.fillRect(x + (c + QUIET) * px, y + (r + QUIET) * px, px, px);
    }
  }
  return side;
}

// A canvas element with the QR, about `targetPx` wide on screen.
export function createQrCanvas(text, targetPx = 200) {
  const { size } = qrModules(text);
  const px = Math.max(2, Math.floor(targetPx / (size + QUIET * 2)));
  const canvas = document.createElement('canvas');
  canvas.className = 'dx-qr';
  canvas.width = canvas.height = (size + QUIET * 2) * px;
  drawQr(canvas.getContext('2d'), text, 0, 0, px);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'QR code of your run link');
  return canvas;
}
