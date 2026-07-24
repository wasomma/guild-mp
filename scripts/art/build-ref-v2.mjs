// Build style-ref-v2: the painterly recolored mannequin with its crossed
// arms surgically replaced by relaxed arms-at-sides, rebuilt from the ref's
// own painterly textures (chest cloned from the waist, arms cloned from the
// legs, fists in skin ramp). The result is a STYLE REFERENCE for bitforge —
// plausibility, not shipped art. Run: node scripts/art/build-ref-v2.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const DIR = "docs/art-src/heroes-d2";
const im = PNG.sync.read(readFileSync(`${DIR}/style-ref-mannequin.png`));
const W = im.width, H = im.height;
const get = (x, y) => {
  const i = (y * W + x) * 4;
  return [im.data[i], im.data[i + 1], im.data[i + 2], im.data[i + 3]];
};
const out = new PNG({ width: W, height: H });
im.data.copy(out.data);
const set = (x, y, r, g, b, a = 255) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = a;
};
const clear = (x, y) => set(x, y, 0, 0, 0, 0);

/* 1. clear the entire arm band beside and across the chest */
for (let y = 34; y <= 60; y++) for (let x = 18; x <= 84; x++) {
  if (y <= 40 && x >= 44 && x <= 62) continue; /* keep the neck column */
  clear(x, y);
}

/* 2. rebuild the torso silhouette: shoulders x38..66 tapering to waist
   x42..62 at y=60, filled with suit texture cloned from the waist below */
for (let y = 36; y <= 60; y++) {
  const t = (y - 36) / 24;
  const x0 = Math.round(38 + 4 * t), x1 = Math.round(66 - 4 * t);
  for (let x = x0; x <= x1; x++) {
    let [r, g, b, a] = get(x, Math.min(H - 1, y + 28));
    if (a < 128) [r, g, b, a] = get(Math.min(61, Math.max(44, x)), Math.min(H - 1, y + 32));
    if (a < 128) { r = 42; g = 39; b = 50; a = 255; }
    set(x, y, r, g, b, 255);
  }
}
/* soft top edge: round the shoulder corners */
for (const [x, y] of [[38, 36], [39, 36], [38, 37], [66, 36], [65, 36], [66, 37]]) clear(x, y);

/* 3. hanging arms cloned from the legs (painterly gray suit texture).
   left arm strip x33..40, right arm strip x64..71, y 40..88 */
for (let y = 40; y <= 88; y++) {
  for (let dx = 0; dx <= 7; dx++) {
    const ly = 108 + (y - 40); /* leg rows as texture source */
    let [r, g, b, a] = get(41 + dx, ly);
    if (a < 128) { r = 38; g = 35; b = 46; a = 255; }
    /* taper the strip: elbows slightly narrower */
    const w0 = y < 46 ? 1 : 0, w1 = y > 80 ? 1 : 0;
    if (dx >= w0 && dx <= 7 - w1) {
      set(33 + dx, y, r, g, b, 255);
      set(64 + dx, y, Math.max(0, r - 6), Math.max(0, g - 6), Math.max(0, b - 6), 255);
    }
  }
}
/* shoulder caps joining arm to torso */
for (let y = 37; y <= 42; y++) for (let x = 35; x <= 42; x++) { const [r,g,b,a] = get(x, y+26); set(x, y, a>127?r:46, a>127?g:43, a>127?b:54, 255); }
for (let y = 37; y <= 42; y++) for (let x = 62; x <= 69; x++) { const [r,g,b,a] = get(x, y+26); set(x, y, a>127?r:40, a>127?g:37, a>127?b:48, 255); }

/* 4. fists in the skin ramp, resting beside the thighs */
const fist = (cx, top) => {
  for (let y = top; y <= top + 7; y++) for (let x = cx; x <= cx + 6; x++) {
    const edge = y === top || y === top + 7 || x === cx || x === cx + 6;
    const lo = y > top + 4;
    set(x, y, edge || lo ? 201 : 232, edge || lo ? 148 : 185, edge || lo ? 101 : 138, 255);
  }
  clear(cx, top); clear(cx + 6, top); clear(cx, top + 7); clear(cx + 6, top + 7);
};
fist(33, 89);
fist(65, 89);

/* 5. mop up remaining warm/gold flecks on the suit (keep head + fists) */
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (y < 38) continue; /* head stays */
  if (y >= 87 && y <= 98 && ((x >= 31 && x <= 41) || (x >= 63 && x <= 73))) continue; /* fists stay */
  const i = (y * W + x) * 4;
  if (out.data[i + 3] < 10) continue;
  const [h, s, l] = rgb2hsl(out.data[i], out.data[i + 1], out.data[i + 2]);
  if (s > 0.25 && (h >= 10 && h <= 70)) {
    const g = Math.round(40 + l * 60);
    out.data[i] = g; out.data[i + 1] = g - 3; out.data[i + 2] = g + 8;
  }
}

writeFileSync(`${DIR}/style-ref-v2.png`, PNG.sync.write(out));
console.log("wrote", `${DIR}/style-ref-v2.png`);
