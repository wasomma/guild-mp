/* The one pick repair that authoring can't do well: K-F2's garments read as
   a brown tube top and denim-style shorts (pockets, fly, long hem) instead
   of undergarments. Cloth repaint is the case /inpaint is actually good at
   (ART-PIPELINE 7D: shape-preserving repaint, as opposed to geometry
   removal), so the chest and hip zones go to the model.

   /inpaint caps at 200x200 and the sheets are 256x256, so the work happens
   in one window that spans both figures, and the result is composited
   STRICTLY through the mask — the API repaints loosely outside it.

   Usage: node scripts/art/fix-picks-ai.mjs <seed> [seed ...] */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;
const DIR = "docs/art-src/heroes-d2/tpose";
const SRC = `${DIR}/px-kitsunekin-f-s8.png`;
const OUT = `${DIR}/fixed`;

/* window (<=200x200) covering both figures' chest + hips */
const BX = 45, BY = 72, BW = 172, BH = 82;

/* Garment zones. Hands hang into the hip band and must NOT be masked —
   a repainted hand is far worse than a leftover garment pixel. */
const ZONES = [
  [52, 77, 36, 24],   // front chest
  [59, 110, 33, 44],  // front hips (left hand ends x58, right starts x92)
  [168, 77, 38, 24],  // back chest
  [165, 110, 37, 44], // back hips (right hand starts x202)
];

const PAL = ["#f6d4a6", "#c99465", "#a87952", "#d9cbb0", "#ece2cd"];
const palB64 = () => {
  const p = new PNG({ width: PAL.length, height: 1 });
  PAL.forEach((h, i) => {
    p.data[i * 4] = parseInt(h.slice(1, 3), 16);
    p.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
    p.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
    p.data[i * 4 + 3] = 255;
  });
  return PNG.sync.write(p).toString("base64");
};

/* Positive-only phrasing: 7D's negatives are token-based and not
   compositional — a "shorts" negative is as likely to delete the garment
   as to shorten it (the same way a "chest" negative deleted a chest wrap). */
const DESC =
  "pixel art character reference sheet, front and back view of the same young woman, " +
  "wearing only plain undyed linen underwear: a simple smooth linen bandeau bra band " +
  "across the chest and plain high-cut linen briefs at the hips, bare midriff, " +
  "bare upper thighs, smooth plain cloth with no pockets and no seams, soft painterly " +
  "cel shading, calm neutral pose";
const NEG = "denim, pocket stitching, belt, buckle, zipper, muddy, blurry, deformed";

async function roll(seed) {
  const img = PNG.sync.read(readFileSync(SRC));
  const { width: W } = img;

  /* The zones are boxes, so they swallow the card background in the gaps
     between arm and torso — and the model paints those gaps solid white
     rather than leaving them be. Subtract the OUTSIDE: flood-fill the
     background colour in from the border (the fit step's own trick), which
     leaves the figure masked while enclosed cream — the garments happen to
     share the background's hex — stays repaintable. */
  const H = img.height;
  const hexAt = (x, y) => {
    const i = (y * W + x) << 2;
    return `#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, "0")).join("")}`;
  };
  const outside = new Uint8Array(W * H);
  const st = [];
  for (let x = 0; x < W; x++) { st.push([x, 0], [x, H - 1]); }
  for (let y = 0; y < H; y++) { st.push([0, y], [W - 1, y]); }
  while (st.length) {
    const [x, y] = st.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (outside[y * W + x] || hexAt(x, y) !== "#ece2cd") continue;
    outside[y * W + x] = 1;
    st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const mask = new Uint8Array(W * H);
  for (const [x, y, w, h] of ZONES)
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (!outside[yy * W + xx]) mask[yy * W + xx] = 1;

  const crop = new PNG({ width: BW, height: BH });
  const mPng = new PNG({ width: BW, height: BH });
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const si = ((BY + y) * W + BX + x) << 2, di = (y * BW + x) << 2;
      for (let k = 0; k < 4; k++) crop.data[di + k] = img.data[si + k];
      const on = mask[(BY + y) * W + BX + x];
      mPng.data[di] = mPng.data[di + 1] = mPng.data[di + 2] = on ? 255 : 0;
      mPng.data[di + 3] = 255;
    }

  const r = await fetch("https://api.pixellab.ai/v1/inpaint", {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: DESC, negative_description: NEG,
      image_size: { width: BW, height: BH },
      inpainting_image: { type: "base64", base64: PNG.sync.write(crop).toString("base64") },
      mask_image: { type: "base64", base64: PNG.sync.write(mPng).toString("base64") },
      color_image: { type: "base64", base64: palB64() },
      no_background: true,
      shading: "detailed shading", detail: "highly detailed", outline: "lineless",
      text_guidance_scale: 9,
      seed,
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`inpaint ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const res = PNG.sync.read(Buffer.from(j.image.base64, "base64"));

  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      if (!mask[(BY + y) * W + BX + x]) continue;
      const si = (y * BW + x) << 2, di = ((BY + y) * W + BX + x) << 2;
      for (let k = 0; k < 4; k++) img.data[di + k] = res.data[si + k];
    }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/K-F2-wear-s${seed}.png`, PNG.sync.write(img));
  console.log(`wrote fixed/K-F2-wear-s${seed}.png  usage ${JSON.stringify(j.usage || {})}`);
}

for (const s of process.argv.slice(2)) await roll(Number(s));
