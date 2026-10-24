// Small runtime shims for older iPad Safari (the build already lowers syntax:
// vite.config.js `target`). Imported first, before anything uses these.
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value(i) { const n = Math.trunc(i) || 0; return this[n < 0 ? this.length + n : n]; },
    configurable: true, writable: true,
  });
}
if (!String.prototype.replaceAll) {
  Object.defineProperty(String.prototype, 'replaceAll', {
    value(a, b) { return a instanceof RegExp ? this.replace(a, b) : this.split(a).join(b); },
    configurable: true, writable: true,
  });
}
if (typeof structuredClone !== 'function') {
  window.structuredClone = (v) => JSON.parse(JSON.stringify(v));
}
