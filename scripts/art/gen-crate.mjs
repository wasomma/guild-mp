// Chronicle Crate generation for the crate-opening ceremony (see docs/balance/ODDS-TABLE.md).
// Follows the prop recipe (pixflux, transparent, palette forced via color_image) at
// crate scale, plus a lid-open inpaint pass over the picked candidate.
//
// Usage:
//   PIXELLAB_SECRET=<token> node scripts/art/gen-crate.mjs roll
//     - chooser round: 2 prompt variants x 5 seeds, closed crates, 96x80.
//       Saves docs/art-src/crate/crate-<v>-s<seed>.png (raw, inpaint-ready)
//       and crate-<v>-s<seed>-3x.png (trimmed 3x review copy).
//   PIXELLAB_SECRET=<token> node scripts/art/gen-crate.mjs open <v>-s<seed> [seed ...]
//     - lid-open round: inpaints the picked raw's lid region open (default
//       seeds 7 17 27), saving crate-open-<v>-s<seed>-i<seed>.png + -3x review.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const KEY = process.env.PIXELLAB_SECRET;
if (!KEY) { console.error("set PIXELLAB_SECRET"); process.exit(1); }
const DIR = "docs/art-src/crate";
mkdirSync(DIR, { recursive: true });

const W = 96, H = 80;
/* the game crate's wood/iron/gold ramp (render.js drawCrate + FITTINGS gold) */
const PAL = ["#2a1c10", "#57381f", "#6f4c2e", "#8a6440", "#916641",
  "#3c3c4c", "#8a8aa0", "#a67c1a", "#c9a227", "#e3c04b"];

function palPng(cols) {
  const p = new PNG({ width: cols.length, height: 1 });
  cols.forEach((h, i) => {
    p.data[i * 4] = parseInt(h.slice(1, 3), 16);
    p.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
    p.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
    p.data[i * 4 + 3] = 255;
  });
  return PNG.sync.write(p).toString("base64");
}

let spentUsd = 0;
async function call(path, body) {
  const r = await fetch("https://api.pixellab.ai/v1" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) { console.log(path, "HTTP", r.status, txt.slice(0, 300)); return null; }
  const j = JSON.parse(txt);
  spentUsd += (j.usage && j.usage.usd) || 0;
  return PNG.sync.read(Buffer.from(j.image.base64.replace(/^data:image\/png;base64,/, ""), "base64"));
}

function bbox(png) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++)
    if (png.data[(y * png.width + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function saveWithReview(raw, prefix) {
  writeFileSync(`${DIR}/${prefix}.png`, PNG.sync.write(raw));
  const b = bbox(raw);
  if (!b) { console.log(prefix, "EMPTY IMAGE"); return; }
  const src = new PNG({ width: b.w, height: b.h });
  for (let y = 0; y < b.h; y++)
    raw.data.copy(src.data, y * b.w * 4, ((y + b.y0) * raw.width + b.x0) * 4, ((y + b.y0) * raw.width + b.x1 + 1) * 4);
  const dst = new PNG({ width: b.w * 3, height: b.h * 3 });
  for (let y = 0; y < dst.height; y++) for (let x = 0; x < dst.width; x++) {
    const si = ((y / 3 | 0) * b.w + (x / 3 | 0)) * 4, di = (y * dst.width + x) * 4;
    for (let k = 0; k < 4; k++) dst.data[di + k] = src.data[si + k];
  }
  writeFileSync(`${DIR}/${prefix}-3x.png`, PNG.sync.write(dst));
  console.log("SAVED", prefix, b.w + "x" + b.h, "(+3x)");
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const [, , cmd, ...args] = process.argv;

if (cmd === "roll") {
  /* two silhouette directions; bright-wood clauses per the enemy-gen learnings
     (dark prompts drift muddy), whole-object clause per the prop recipe */
  const VARIANTS = {
    a: "ornate fantasy wooden treasure chest, closed, seen straight from the front, " +
      "storybook fairytale style, warm oak brown wooden planks, carved rune engravings " +
      "on the front panel, brass corner bands with rivets, large golden padlock hanging " +
      "at the front center, bright warm wood tones dominate, evenly lit, centered, " +
      "the whole chest visible with margin around it",
    b: "sturdy medieval wooden crate strongbox, closed, front view, rich warm oak planks, " +
      "dark iron straps and rivets at the corners, heavy golden padlock on the front, " +
      "small carved runes along the lid edge, bright even lighting, warm wood tones " +
      "dominate, centered, the whole crate visible with margin around it",
  };
  for (const [v, desc] of Object.entries(VARIANTS)) {
    for (const seed of [11, 22, 33, 44, 55]) {
      const png = await call("/generate-image-pixflux", {
        description: desc,
        negative_description: "dark, muddy, blurry, background scenery, open lid",
        image_size: { width: W, height: H },
        no_background: true,
        shading: "detailed shading", detail: "highly detailed", outline: "lineless",
        text_guidance_scale: 8,
        color_image: { type: "base64", base64: palPng(PAL) },
        seed,
      });
      if (png) saveWithReview(png, `crate-${v}-s${seed}`);
      await sleep(400);
    }
  }
} else if (cmd === "open") {
  const pick = args[0];
  if (!pick) { console.error("usage: gen-crate.mjs open <v>-s<seed> [inpaint seeds...]"); process.exit(1); }
  const raw = PNG.sync.read(readFileSync(`${DIR}/crate-${pick}.png`));
  const b = bbox(raw);
  if (!b) { console.error("picked raw is empty"); process.exit(1); }
  /* repaintable region: everything from the canvas top down through the lid
     third, full crate width plus margin, so the model has headroom to swing
     the lid up; body below the lid line is protected */
  const lidY = Math.round(b.y0 + b.h * 0.38);
  const mask = new PNG({ width: raw.width, height: raw.height });
  for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
    const inside = y <= lidY && x >= b.x0 - 6 && x <= b.x1 + 6;
    const i = (y * raw.width + x) * 4;
    mask.data[i] = mask.data[i + 1] = mask.data[i + 2] = inside ? 255 : 0;
    mask.data[i + 3] = 255;
  }
  const seeds = args.slice(1).length ? args.slice(1).map(Number) : [7, 17, 27];
  for (const seed of seeds) {
    const png = await call("/inpaint", {
      description: "the same wooden chest with its hinged lid swung wide open upward, " +
        "warm golden light glowing out of the open chest, bright warm wood tones, evenly lit",
      negative_description: "closed lid, dark, muddy, blurry, new objects",
      image_size: { width: raw.width, height: raw.height },
      inpainting_image: { type: "base64", base64: PNG.sync.write(raw).toString("base64") },
      mask_image: { type: "base64", base64: PNG.sync.write(mask).toString("base64") },
      color_image: { type: "base64", base64: palPng(PAL) },
      no_background: true,
      shading: "detailed shading", detail: "highly detailed", outline: "lineless",
      text_guidance_scale: 8,
      seed,
    });
    if (png) saveWithReview(png, `crate-open-${pick}-i${seed}`);
    await sleep(400);
  }
} else {
  console.error("usage: gen-crate.mjs roll | open <v>-s<seed> [seeds...]");
  process.exit(1);
}
console.log("API spend this run: $" + spentUsd.toFixed(3));
