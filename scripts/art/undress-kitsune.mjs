// Step 1 of the kitsune-as-donor plan (owner, 2026-07-24): strip the
// stylized hair (with ears + tail) and clothing from the kitsune raw at her
// native 128x256 detail. Two inpaint passes, each windowed under the
// 200-row cap with a 12-row seam re-band:
//   node scripts/art/undress-kitsune.mjs bald <seed>   -> kitsune-bald-s<seed>.png
//   node scripts/art/undress-kitsune.mjs skin <baldSeed> <seed>   -> kitsune-base-s<seed>.png
// The spear and her hands are left untouched on purpose (pose surgery is a
// separate owner decision). Nothing here touches shipped assets.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;
const DIR = "docs/art-src/heroes-d2";
const RAW = "docs/art-src/kitsune-hd/body-s2.png";
const W = 128, H = 256;

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

function chromaMask(png, test, dilate = 2) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (png.data[i + 3] < 128) continue;
    if (test(...rgb2hsl(png.data[i], png.data[i + 1], png.data[i + 2]), x, y)) m[y * W + x] = 1;
  }
  const out = new Uint8Array(m);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue;
    for (let dy = -dilate; dy <= dilate; dy++) for (let dx = -dilate; dx <= dilate; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < H && xx >= 0 && xx < W) out[yy * W + xx] = 1;
    }
  }
  return out;
}

const palB64 = (cols) => {
  const p = new PNG({ width: cols.length, height: 1 });
  cols.forEach((h, i) => {
    p.data[i * 4] = parseInt(h.slice(1, 3), 16);
    p.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
    p.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
    p.data[i * 4 + 3] = 255;
  });
  return PNG.sync.write(p).toString("base64");
};

async function inpaintWindow(img, mask, y0, y1, desc, neg, pal, seed) {
  const winH = y1 - y0 + 1;
  const crop = new PNG({ width: W, height: winH });
  img.data.copy(crop.data, 0, y0 * W * 4, (y1 + 1) * W * 4);
  const mPng = new PNG({ width: W, height: winH });
  for (let y = 0; y < winH; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const on = mask[(y0 + y) * W + x];
    mPng.data[i] = mPng.data[i + 1] = mPng.data[i + 2] = on ? 255 : 0;
    mPng.data[i + 3] = 255;
  }
  const r = await fetch("https://api.pixellab.ai/v1/inpaint", {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: desc, negative_description: neg,
      image_size: { width: W, height: winH },
      inpainting_image: { type: "base64", base64: PNG.sync.write(crop).toString("base64") },
      mask_image: { type: "base64", base64: PNG.sync.write(mPng).toString("base64") },
      color_image: { type: "base64", base64: palB64(pal) },
      no_background: true,
      shading: "detailed shading", detail: "highly detailed", outline: "lineless",
      text_guidance_scale: 10, seed,
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error("inpaint " + r.status + ": " + JSON.stringify(j).slice(0, 300));
  const res = PNG.sync.read(Buffer.from(j.image.base64, "base64"));
  res.data.copy(img.data, y0 * W * 4);
  return (j.usage && j.usage.usd) || 0;
}

/* windows: rows 0-199, then 188-255 (12-row seam re-band inside the second) */
async function windowedPass(img, mask, desc, neg, pal, seed) {
  let usd = 0;
  const hasLow = mask.some((v, i) => v && (i / W | 0) >= 188);
  usd += await inpaintWindow(img, mask, 0, 199, desc, neg, pal, seed);
  if (hasLow) {
    const m2 = new Uint8Array(mask);
    for (let y = 0; y < 188; y++) for (let x = 0; x < W; x++) m2[y * W + x] = 0;
    /* re-open the seam band so the join is repainted with fresh context */
    for (let y = 188; y < 200; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) m2[y * W + x] = 1;
    usd += await inpaintWindow(img, m2, 56, 255, desc, neg, pal, seed + 100);
  }
  return usd;
}

const SKIN_PAL = ["#e8b98a", "#c99465", "#f6d4a6", "#a87952"];
const [cmd, a1, a2] = process.argv.slice(2);

if (cmd === "bald") {
  const seed = Number(a1) || 1;
  const img = PNG.sync.read(readFileSync(RAW));
  /* hair + ears + tail: the green family, the pink tips, the pale pink
     inner-ear fur, plus everything above the face line */
  const mask = chromaMask(img, (h, s, l, x, y) => {
    if (h >= 80 && h <= 165 && s > 0.15) return true;               /* green hair/tail */
    if (h >= 295 && h <= 345 && s > 0.35 && l > 0.45) return true;  /* pink tips */
    if (h >= 320 || h <= 20) { if (s > 0.15 && l > 0.62 && y < 70) return true; } /* inner ear */
    if (y < 34 && x < 90) return true; /* ear tips zone — x-guard protects the spear head */
    return false;
  }, 2);
  /* LEARNING (6 seeds): the MASK SHAPE is the prior — a hair-shaped repaint
     region regrows hair whether the pixels are present or pre-cleared. To
     delete geometry: clear the pixels, leave the cleared area UNMASKED so it
     stays transparent, and repaint only a thin closure band where the
     cleared region hugs the surviving silhouette. */
  for (let i = 0; i < W * H; i++) if (mask[i]) img.data[i * 4 + 3] = 0;
  /* closure only where clearing exposed missing body: the scalp and the
     hair-framed face/shoulder edges (y < 130). The hair merely hung BESIDE
     the legs and the tail sat BEHIND the hips — no repair there, or the
     band paints tan edging along silhouettes that were already complete. */
  const band = new Uint8Array(W * H);
  const R = 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x] || y >= 130 || x >= 90) continue;
    let nearBody = false;
    for (let dy = -R; dy <= R && !nearBody; dy++) for (let dx = -R; dx <= R; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
      if (!mask[yy * W + xx] && img.data[(yy * W + xx) * 4 + 3] > 127) { nearBody = true; break; }
    }
    if (nearBody) band[y * W + x] = 1;
  }
  /* the face is genuinely small — her apparent skull was hair volume. Give
     the model a full cranium dome to paint into (transparent pixels only,
     so the surviving face anchors it), or the bald head comes out pin-sized. */
  const DOME = { cx: 66, cy: 52, rx: 18, ry: 22 };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x - DOME.cx) / DOME.rx, ny = (y - DOME.cy) / DOME.ry;
    if (nx * nx + ny * ny <= 1 && img.data[(y * W + x) * 4 + 3] < 128) band[y * W + x] = 1;
  }
  const usd = await windowedPass(img, band,
    "completely bald young woman, no hair, smooth bare scalp, soft gentle painterly face with gold eyes, calm slight smile, soft cel shading",
    "hair, fox ears, animal ears, tail, hood, helmet, muddy, blurry, deformed",
    SKIN_PAL, seed);
  /* drop anything not connected to the main figure (7D debris rule) */
  /* size threshold, not largest-only: hair clearing can briefly sever the
     face from the neck, and largest-only deleted the whole head once */
  const seen = new Uint8Array(W * H);
  const stack = [];
  const keep = new Uint8Array(W * H);
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || img.data[s0 * 4 + 3] < 128) continue;
    const comp = [];
    stack.push(s0); seen[s0] = 1;
    while (stack.length) {
      const i = stack.pop(); comp.push(i);
      const cx = i % W, cy = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (!seen[ni] && img.data[ni * 4 + 3] >= 128) { seen[ni] = 1; stack.push(ni); }
      }
    }
    if (comp.length >= 50) for (const i of comp) keep[i] = 1;
  }
  for (let i = 0; i < W * H; i++) if (!keep[i]) img.data[i * 4 + 3] = 0;
  /* re-bridge the spear shaft where the cleared tail tip crossed it: fill
     vertical alpha gaps in the shaft columns with the pattern from above */
  for (let x = 90; x < 112; x++) {
    let lastSolid = -1;
    for (let y = 120; y < 245; y++) {
      const a = img.data[(y * W + x) * 4 + 3];
      if (a >= 128) {
        if (lastSolid >= 0 && y - lastSolid > 1 && y - lastSolid < 40) {
          for (let fy = lastSolid + 1; fy < y; fy++) {
            const si = (lastSolid * W + x) * 4, di = (fy * W + x) * 4;
            img.data[di] = img.data[si]; img.data[di + 1] = img.data[si + 1];
            img.data[di + 2] = img.data[si + 2]; img.data[di + 3] = 255;
          }
        }
        lastSolid = y;
      }
    }
  }
  writeFileSync(`${DIR}/kitsune-bald-s${seed}.png`, PNG.sync.write(img));
  console.log(`kitsune-bald-s${seed}.png usd ~${usd.toFixed(3)}`);
} else if (cmd === "skin") {
  const baldSeed = Number(a1) || 1, seed = Number(a2) || 1;
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-bald-s${baldSeed}.png`));
  /* clothing: wine cloth, black leggings/darks, gold/brass metal — all
     restricted below the chin and left of the spear (x < 96) */
  const mask = chromaMask(img, (h, s, l, x, y) => {
    if (y < 84) return false;
    /* spear guard: columns >= 96 are hers only in the pauldron band; the
       shaft leans left below the grip, so the dark rule stops at x 91 */
    const pauldron = y <= 112 && x < 101;
    if (x >= 96 && !pauldron) return false;
    if ((h >= 330 || h <= 15) && s > 0.2 && l < 0.55) return true;  /* wine cloth */
    if (l < 0.24 && x < 91) return true;                             /* leggings + darks */
    if (l < 0.3 && y >= 112 && y <= 152 && x >= 84) return true;     /* grip gloves, both hands */
    if (l < 0.3 && y >= 84 && y <= 104 && x >= 60 && x < 91) return true; /* neckline strap fleck */
    if (h >= 33 && h <= 58 && s > 0.4) return true;                  /* gold armor/belt/boots */
    if (l > 0.85 && s < 0.2 && y < 104) return true;                 /* white collar fleck */
    return false;
  }, 2);
  const usd = await windowedPass(img, mask,
    "bare natural body of a young woman with smooth golden skin, simple clean pixel-art figure, bare arms and legs, barefoot with simple bare feet, soft painterly cel shading",
    "clothing, fabric, armor, gold trim, jewelry, boots, shoes, belt, nipples, explicit anatomy, muddy, blurry, deformed",
    SKIN_PAL, seed);
  writeFileSync(`${DIR}/kitsune-base-s${seed}.png`, PNG.sync.write(img));
  console.log(`kitsune-base-s${seed}.png usd ~${usd.toFixed(3)}`);
} else if (cmd === "finish") {
  /* final polish on a picked base seed:
     1. targeted inpaint of the surviving shoulder pauldron (it straddles the
        skin pass's y<84 head guard) into a bare skin shoulder;
     2. deterministic spear restore — stamp the original raw's spear pixels
        (x>=93, spear-colored) over whatever the passes melted. */
  const baseSeed = Number(a1) || 4, seed = Number(a2) || 1;
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-base-s${baseSeed}.png`));
  const mask = chromaMask(img, (h, s, l, x, y) => {
    if (y < 64 || y > 104 || x < 82 || x > 106) return false;
    return h >= 30 && h <= 60 && s > 0.35;
  }, 2);
  const usd = await inpaintWindow(img, mask, 0, 199,
    "bare natural shoulder with smooth golden skin, soft painterly cel shading",
    "armor, gold, metal, clothing, muddy, blurry", SKIN_PAL, seed);
  const raw = PNG.sync.read(readFileSync(RAW));
  for (let y = 4; y < 250; y++) for (let x = 93; x < W; x++) {
    const i = (y * W + x) * 4;
    if (raw.data[i + 3] < 128) continue;
    const [h, s, l] = rgb2hsl(raw.data[i], raw.data[i + 1], raw.data[i + 2]);
    /* dark wood only within the shaft's drift band, or the raw tail-tip
       outline at x>104 stamps back as a ghost */
    const inShaft = y < 150 ? x <= 104 : x <= 101;
    const spear = (h >= 30 && h <= 58 && s > 0.35 && y < 150) || (l < 0.3 && inShaft) ||
      (l > 0.78 && s < 0.25 && y >= 108 && y <= 145 && x >= 96 && x <= 108);
    if (spear) {
      img.data[i] = raw.data[i]; img.data[i + 1] = raw.data[i + 1];
      img.data[i + 2] = raw.data[i + 2]; img.data[i + 3] = 255;
    }
  }
  /* drop stray disconnected paint (same threshold rule as the bald pass) */
  {
    const seen = new Uint8Array(W * H);
    const stack = [];
    const keep = new Uint8Array(W * H);
    for (let s0 = 0; s0 < W * H; s0++) {
      if (seen[s0] || img.data[s0 * 4 + 3] < 128) continue;
      const comp = [];
      stack.push(s0); seen[s0] = 1;
      while (stack.length) {
        const i = stack.pop(); comp.push(i);
        const cx = i % W, cy = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (!seen[ni] && img.data[ni * 4 + 3] >= 128) { seen[ni] = 1; stack.push(ni); }
        }
      }
      if (comp.length >= 50) for (const i of comp) keep[i] = 1;
    }
    for (let i = 0; i < W * H; i++) if (!keep[i]) img.data[i * 4 + 3] = 0;
  }
  writeFileSync(`${DIR}/kitsune-donor.png`, PNG.sync.write(img));
  console.log(`kitsune-donor.png (from base s${baseSeed}) usd ~${usd.toFixed(3)}`);
} else {
  console.log("usage: bald <seed> | skin <baldSeed> <seed> | finish <baseSeed> <seed>");
}
