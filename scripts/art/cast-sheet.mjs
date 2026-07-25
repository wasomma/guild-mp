/* Line the fitted race bases up on one ground line, beside the shipped HD
   kitsune, for the owner's scale + style check.
   node scripts/art/cast-sheet.mjs [front|back] <out.png> */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const DIR = "docs/art-src/heroes-d2/tpose";
const face = process.argv[2] === "back" ? "back" : "front";
const out = process.argv[3] || `${DIR}/cast-${face}.png`;

const CAST = [
  ["kitsune", "client/public/assets/heroes/kitsune-e-body.png"],
  ["human f", `${DIR}/base-human-f-${face}.png`],
  ["human m", `${DIR}/base-human-m-${face}.png`],
  ["elf f", `${DIR}/base-elf-f-${face}.png`],
  ["elf m", `${DIR}/base-elf-m-${face}.png`],
  ["kits. f", `${DIR}/base-kitsunekin-f-${face}.png`],
  ["kits. m", `${DIR}/base-kitsunekin-m-${face}.png`],
  ["dwarf f", `${DIR}/base-dwarf-f-${face}.png`],
  ["dwarf m", `${DIR}/base-dwarf-m-${face}.png`],
  ["orc f", `${DIR}/base-orc-f-${face}.png`],
  ["orc m", `${DIR}/base-orc-m-${face}.png`],
  ["tief. f", `${DIR}/base-tiefling-f-${face}.png`],
  ["tief. m", `${DIR}/base-tiefling-m-${face}.png`],
];

const imgs = CAST.map(([name, path]) => {
  try { return { name, png: PNG.sync.read(readFileSync(path)) }; }
  catch { console.log(`missing: ${path}`); return null; }
}).filter(Boolean);

const PAD = 14, TOP = 16, FOOT = 22;
const H = Math.max(...imgs.map((i) => i.png.height)) + TOP + FOOT;
const W = imgs.reduce((a, i) => a + i.png.width + PAD, PAD);
const sheet = new PNG({ width: W, height: H });
/* dark slate ground so the light linen and the cream card both read */
for (let i = 0; i < W * H; i++) {
  sheet.data[i * 4] = 34; sheet.data[i * 4 + 1] = 30;
  sheet.data[i * 4 + 2] = 40; sheet.data[i * 4 + 3] = 255;
}
const ground = H - FOOT;
for (let x = 0; x < W; x++) {
  const i = (ground * W + x) * 4;
  sheet.data[i] = 90; sheet.data[i + 1] = 80; sheet.data[i + 2] = 66;
}

let x0 = PAD;
for (const { name, png } of imgs) {
  const y0 = ground - png.height;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const si = (y * png.width + x) * 4;
      if (png.data[si + 3] < 128) continue;
      const di = ((y0 + y) * W + x0 + x) * 4;
      sheet.data[di] = png.data[si]; sheet.data[di + 1] = png.data[si + 1];
      sheet.data[di + 2] = png.data[si + 2]; sheet.data[di + 3] = 255;
    }
  /* a tick under each figure marks its slot without needing a font */
  for (let x = x0; x < x0 + png.width; x++) {
    const i = ((ground + 4) * W + x) * 4;
    sheet.data[i] = 200; sheet.data[i + 1] = 170; sheet.data[i + 2] = 110;
  }
  console.log(`${name.padEnd(9)} ${String(png.width).padStart(3)}x${png.height}  at x=${x0}`);
  x0 += png.width + PAD;
}
writeFileSync(out, PNG.sync.write(sheet));
console.log(`\n${out}  ${W}x${H}`);
