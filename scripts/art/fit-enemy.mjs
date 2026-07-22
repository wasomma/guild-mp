// Fit a raw generated enemy sprite onto the P2 texel grid: trim transparent
// margins, nearest-resample to an exact texel height (preserving aspect),
// then 2x upscale so 1 texel = 2px. Optionally mirror (enemies face LEFT).
// Usage: node fit-enemy.mjs <rawPng> <outPng> <texelHeight> [flip]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const [, , inFile, outFile, texelHStr, flip] = process.argv;
const raw = PNG.sync.read(readFileSync(inFile));
let x0 = raw.width, y0 = raw.height, x1 = -1, y1 = -1;
for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
  if (raw.data[(y * raw.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
if (x1 < 0) { console.error(inFile, "EMPTY IMAGE"); process.exit(1); }
const w = x1 - x0 + 1, h = y1 - y0 + 1;
const th = Number(texelHStr), tw = Math.max(1, Math.round((w / h) * th));
/* hard alpha while resampling: partial-alpha edges violate the grid rules */
const texel = Buffer.alloc(tw * th * 4);
for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
  const sx = x0 + Math.min(w - 1, Math.floor(((x + 0.5) / tw) * w));
  const sy = y0 + Math.min(h - 1, Math.floor(((y + 0.5) / th) * h));
  const si = (sy * raw.width + sx) * 4, di = (y * tw + x) * 4;
  const a = raw.data[si + 3] > 127 ? 255 : 0;
  texel[di] = raw.data[si]; texel[di + 1] = raw.data[si + 1];
  texel[di + 2] = raw.data[si + 2]; texel[di + 3] = a;
}
const dst = new PNG({ width: tw * 2, height: th * 2 });
for (let y = 0; y < dst.height; y++) for (let x = 0; x < dst.width; x++) {
  const gx = flip === "flip" ? tw - 1 - (x >> 1) : x >> 1;
  const si = ((y >> 1) * tw + gx) * 4, di = (y * dst.width + x) * 4;
  for (let k = 0; k < 4; k++) dst.data[di + k] = texel[si + k];
}
writeFileSync(outFile, PNG.sync.write(dst));
console.log(outFile, dst.width + "x" + dst.height, "(" + tw + "x" + th + " texels)");
