// Re-scale a raw generated prop: trim transparent margins, optionally halve
// resolution (nearest), then upscale by an integer texel factor.
// Usage: node scale-prop.mjs <rawPng> <outPng> <texelFactor> [halve]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const [, , inFile, outFile, factorStr, halve] = process.argv;
const raw = PNG.sync.read(readFileSync(inFile));
let x0 = raw.width, y0 = raw.height, x1 = -1, y1 = -1;
for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
  if (raw.data[(y * raw.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
let w = x1 - x0 + 1, h = y1 - y0 + 1;
let src = { width: w, height: h, at: (x, y, k) => raw.data[((y + y0) * raw.width + (x + x0)) * 4 + k] };
if (halve === "halve") {
  const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
  const buf = Buffer.alloc(hw * hh * 4);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
    const sx = Math.min(w - 1, x * 2), sy = Math.min(h - 1, y * 2);
    for (let k = 0; k < 4; k++) buf[(y * hw + x) * 4 + k] = src.at(sx, sy, k);
  }
  src = { width: hw, height: hh, at: (x, y, k) => buf[(y * hw + x) * 4 + k] };
}
const f = Number(factorStr);
const dst = new PNG({ width: src.width * f, height: src.height * f });
for (let y = 0; y < dst.height; y++) for (let x = 0; x < dst.width; x++) {
  const di = (y * dst.width + x) * 4;
  for (let k = 0; k < 4; k++) dst.data[di + k] = src.at((x / f) | 0, (y / f) | 0, k);
}
writeFileSync(outFile, PNG.sync.write(dst));
console.log(outFile, dst.width + "x" + dst.height);
