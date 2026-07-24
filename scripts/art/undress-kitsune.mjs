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
  /* the API repaints loosely around the mask — composite strictly through
     it so only masked pixels can change */
  for (let y = 0; y < winH; y++) for (let x = 0; x < W; x++) {
    if (mask[(y0 + y) * W + x]) continue;
    const i = (y * W + x) * 4;
    res.data[i] = crop.data[i]; res.data[i + 1] = crop.data[i + 1];
    res.data[i + 2] = crop.data[i + 2]; res.data[i + 3] = crop.data[i + 3];
  }
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
} else if (cmd === "spearless") {
  /* owner call (checkpoint 3): the donor goes empty-handed.
     LEARNING (3 seeds): chroma-clearing the spear leaves fragments (the
     head's RED gem facets sit below hue 30) and the model reconnects them
     into a new spear; closure bands that touch the thigh shadows bulk the
     legs. So: clear the whole spear BAND geometrically wherever no anatomy
     overlaps, chroma-clear only inside the hand rows, and repaint nothing
     but the two hand boxes. */
  const seed = Number(a1) || 1;
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-donor.png`));
  const clear = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (img.data[i + 3] < 128) continue;
    if (y < 100 && x >= 91) { clear[y * W + x] = 1; continue; }          /* head + upper shaft: spear only */
    if (y > 164 && x >= 90 && x <= 106) { clear[y * W + x] = 1; continue; } /* lower shaft beside the leg */
    if (y >= 100 && y <= 164 && x >= 88) {
      const [h, s, l] = rgb2hsl(img.data[i], img.data[i + 1], img.data[i + 2]);
      const wood = l < 0.32;
      const metal = ((h >= 25 && h <= 58) || h <= 25) && s > 0.5 && l < 0.55;
      const wrap = l > 0.75 && s < 0.28 && x >= 94;
      if (wood || metal || wrap) clear[y * W + x] = 1;
    }
  }
  for (let i = 0; i < W * H; i++) if (clear[i]) img.data[i * 4 + 3] = 0;
  /* repaint: the two hand boxes only, plus a 2px closure band that stays
     inside the hand rows so the body silhouette is never touched */
  const band = new Uint8Array(W * H);
  for (let y = 104; y <= 130; y++) for (let x = 92; x <= 112; x++) band[y * W + x] = 1;
  for (let y = 130; y <= 158; y++) for (let x = 86; x <= 104; x++) band[y * W + x] = 1;
  const usd = await inpaintWindow(img, band, 0, 199,
    "bare natural hands relaxed as loose fists, smooth golden skin, simple fingers, empty hands holding nothing, soft painterly cel shading",
    "spear, weapon, staff, pole, stick, gloves, gauntlets, clothing, gold, metal, muddy, blurry, deformed hands, extra fingers",
    SKIN_PAL, seed);
  /* drop disconnected leftovers (spearhead fragments, shaft stubs) */
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
  writeFileSync(`${DIR}/kitsune-donor-nospear-s${seed}.png`, PNG.sync.write(img));
  console.log(`kitsune-donor-nospear-s${seed}.png usd ~${usd.toFixed(3)}`);
} else if (cmd === "repose") {
  /* owner call: arms preemptively reposed to relaxed at-sides so the style
     reference doesn't teach every mannequin her raised-hands pose. The
     forearms cross the chest, so there is no clean arm/torso separation —
     instead the whole arm band is cleared and rebuilt from shaped zones:
     the torso trapezoid refills as chest (shape prior = body), and two
     arm strips + fist boxes grow the hanging arms (the cranium-dome trick,
     sideways). Head, hips, and legs stay untouched as identity anchors. */
  const seed = Number(a1) || 1;
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-donor-nospear.png`));
  for (let y = 80; y <= 126; y++) for (let x = 0; x < W; x++) img.data[(y * W + x) * 4 + 3] = 0;
  const band = new Uint8Array(W * H);
  const zone = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) band[y * W + x] = 1; };
  /* torso: interpolated trapezoid from shoulder line to the hip join */
  for (let y = 80; y <= 126; y++) {
    const t = (y - 80) / 46;
    const x0 = Math.round(48 + 8 * t), x1 = Math.round(84 - 4 * t);
    for (let x = x0; x <= x1; x++) band[y * W + x] = 1;
  }
  zone(78, 84, 92, 148);   /* near arm, hanging in front of the hip line */
  zone(78, 148, 92, 162);  /* near fist beside the thigh */
  zone(42, 84, 54, 142);   /* far arm sliver behind the torso */
  zone(42, 142, 54, 156);  /* far fist */
  const usd = await inpaintWindow(img, band, 0, 199,
    "young woman standing in three-quarter view facing right, bare natural body with smooth golden skin, both arms hanging relaxed straight down at her sides, hands in loose fists resting beside her thighs, well-drawn five-fingered hands, soft painterly cel shading",
    "raised arms, crossed arms, bent elbows, hands in front, clothing, weapon, muddy, blurry, deformed hands, extra fingers, extra limbs",
    SKIN_PAL, seed);
  writeFileSync(`${DIR}/kitsune-posed-s${seed}.png`, PNG.sync.write(img));
  console.log(`kitsune-posed-s${seed}.png usd ~${usd.toFixed(3)}`);
} else if (cmd === "repose2") {
  /* LEARNING (repose, 4 seeds): open repaint zones are permission, not
     command — the model's prior painted crossed arms inside them every
     time. repose2 removes the choice: the armless torso and both hanging
     arms are BUILT deterministically as a shaded scaffold from her own
     skin ramp, then ONE shape-preserving polish inpaint refines the
     shading over exactly those pixels. Geometry ours, brushwork the
     model's. */
  const seed = Number(a1) || 1;
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-donor-nospear.png`));
  const set = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img.data[i] = parseInt(hex.slice(1, 3), 16);
    img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
    img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
    img.data[i + 3] = 255;
  };
  const SK = "#e8b98a", SKD = "#c99465", SKDD = "#a87952", SKL = "#f6d4a6";
  for (let y = 80; y <= 126; y++) for (let x = 0; x < W; x++) img.data[(y * W + x) * 4 + 3] = 0;
  const scaffold = new Uint8Array(W * H);
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) scaffold[y * W + x] = 1; };
  /* torso: tapered capsule, back (left) in shadow, light from upper right */
  for (let y = 80; y <= 126; y++) {
    const t = (y - 80) / 46;
    const x0 = Math.round(48 + 8 * t), x1 = Math.round(84 - 4 * t);
    for (let x = x0; x <= x1; x++) {
      const f = (x - x0) / Math.max(1, x1 - x0);
      set(x, y, f < 0.16 ? SKDD : f < 0.4 ? SKD : f < 0.82 ? SK : SKL);
      mark(x, y);
    }
  }
  /* hanging arms: shaded capsules ending in simple fists */
  const capsule = (cx0, y0, cx1, y1, w, shade) => {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const cx = cx0 + (cx1 - cx0) * t;
      for (let dx = -w / 2; dx <= w / 2; dx++) {
        const x = Math.round(cx + dx);
        const f = (dx + w / 2) / w;
        set(x, y, shade === "far" ? (f < 0.3 ? SKDD : SKD) : (f < 0.2 ? SKD : f < 0.75 ? SK : SKL));
        mark(x, y);
      }
    }
  };
  const fist = (cx, top, shade) => {
    for (let y = top; y <= top + 9; y++) for (let dx = -4; dx <= 4; dx++) {
      if ((y === top || y === top + 9) && Math.abs(dx) > 2) continue;
      const x = Math.round(cx + dx);
      const f = (dx + 4) / 8;
      set(x, y, shade === "far" ? (f < 0.35 ? SKDD : SKD) : (y > top + 6 ? SKD : f < 0.25 ? SKD : SK));
      mark(x, y);
    }
    for (let dx = -3; dx <= 3; dx++) { const x = Math.round(cx + dx); set(x, top + 4, shade === "far" ? SKDD : SKD); mark(x, top + 4); }
  };
  capsule(85, 84, 86, 146, 8, "near");
  fist(86, 147, "near");
  capsule(48, 86, 46, 136, 6, "far");
  fist(46, 137, "far");
  /* shoulder caps rounding into the arms */
  for (let y = 80; y <= 88; y++) for (let x = 80; x <= 90; x++) { const f = (x - 80) / 10; set(x, y, f < 0.5 ? SK : SKL); mark(x, y); }
  for (let y = 82; y <= 90; y++) for (let x = 44; x <= 52; x++) { set(x, y, x < 48 ? SKDD : SKD); mark(x, y); }
  writeFileSync(`${DIR}/kitsune-scaffold.png`, PNG.sync.write(img));
  /* polish: shape-preserving repaint over the scaffold pixels only */
  const band = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!scaffold[y * W + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < H && xx >= 0 && xx < W) band[yy * W + xx] = 1;
    }
  }
  const usd = await inpaintWindow(img, band, 0, 199,
    "young woman standing in three-quarter view facing right, bare slim torso with smooth golden skin, both arms hanging relaxed straight down at her sides, hands in loose fists resting beside her thighs, soft painterly cel shading with warm light from the upper right",
    "raised arms, crossed arms, bent elbows, clothing, weapon, muddy, blurry, deformed hands, extra fingers, extra limbs",
    SKIN_PAL, seed);
  writeFileSync(`${DIR}/kitsune-posed2-s${seed}.png`, PNG.sync.write(img));
  console.log(`kitsune-posed2-s${seed}.png usd ~${usd.toFixed(3)}`);
} else if (cmd === "repose3") {
  /* LEARNING (repose2): even a scaffold-shaped mask admits the crossed-arm
     solution when torso and arms share one repaint region. repose3 polishes
     in three separately masked passes — torso alone, then each arm capsule
     alone — so no mask can fit anything but its own limb. */
  const seed = Number(a1) || 1;
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-scaffold.png`));
  const torso = new Uint8Array(W * H), armN = new Uint8Array(W * H), armF = new Uint8Array(W * H);
  for (let y = 80; y <= 126; y++) {
    const t = (y - 80) / 46;
    const x0 = Math.round(48 + 8 * t), x1 = Math.round(84 - 4 * t);
    for (let x = x0; x <= x1; x++) torso[y * W + x] = 1;
  }
  /* subtract the arm capsules from the torso mask so each pass owns its pixels */
  const cap = (m, cx0, y0, cx1, y1, w) => {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const cx = cx0 + (cx1 - cx0) * t;
      for (let dx = -w / 2 - 1; dx <= w / 2 + 1; dx++) {
        const x = Math.round(cx + dx);
        if (x >= 0 && x < W) { m[y * W + x] = 1; torso[y * W + x] = 0; }
      }
    }
  };
  cap(armN, 85, 82, 86, 158, 9);
  cap(armF, 48, 84, 46, 148, 8);
  let usd = 0;
  usd += await inpaintWindow(img, torso, 0, 199,
    "bare slim female torso in three-quarter view facing right, smooth golden skin, flat stomach, no arms visible, soft painterly cel shading with warm light from the upper right",
    "arms, hands, elbows, fingers, clothing, muddy, blurry", SKIN_PAL, seed);
  usd += await inpaintWindow(img, armN, 0, 199,
    "a single bare slender arm hanging straight down relaxed, smooth golden skin, ending in a small loose fist with simple fingers, soft painterly cel shading",
    "bent elbow, raised arm, crossed arm, open palm, clothing, muddy, blurry, deformed hands, extra fingers", SKIN_PAL, seed + 40);
  usd += await inpaintWindow(img, armF, 0, 199,
    "a single bare slender arm in shadow hanging straight down relaxed behind the body, muted golden skin, ending in a small loose fist, soft painterly cel shading",
    "bent elbow, raised arm, crossed arm, open palm, clothing, muddy, blurry, deformed hands, extra fingers", SKIN_PAL, seed + 80);
  writeFileSync(`${DIR}/kitsune-posed3-s${seed}.png`, PNG.sync.write(img));
  console.log(`kitsune-posed3-s${seed}.png usd ~${usd.toFixed(3)}`);
} else if (cmd === "armfix") {
  /* FINAL repose recipe, fully deterministic: the inpaint model draws
     crossed arms in wide masks and smudge in narrow ones, and its
     "contained" torso came back ragged — so the whole upper body is
     AUTHORED: a cleanly shaded torso trapezoid (collarbone + chest crease
     hints) with both hanging arms attached to its edges, drawn in the
     body's own skin ramp. Head, hips, legs remain her real pixels. */
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-donor-nospear.png`));
  const T = { dd: "#a87952", d: "#c99465", m: "#e8b98a", l: "#f6d4a6" };
  const px = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img.data[i] = parseInt(hex.slice(1, 3), 16);
    img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
    img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
    img.data[i + 3] = 255;
  };
  /* wipe the whole old arm band, plus the old hand remnants that reach
     below it beyond the hip silhouette */
  for (let y = 80; y <= 126; y++) for (let x = 0; x < W; x++) img.data[(y * W + x) * 4 + 3] = 0;
  for (let y = 127; y <= 166; y++) for (let x = 86; x < W; x++) img.data[(y * W + x) * 4 + 3] = 0;
  const xL = (y) => 48 + 8 * (y - 80) / 46, xR = (y) => 84 - 4 * (y - 80) / 46;
  /* torso */
  for (let y = 80; y <= 126; y++) {
    const x0 = Math.round(xL(y)), x1 = Math.round(xR(y));
    for (let x = x0; x <= x1; x++) {
      const f = (x - x0) / Math.max(1, x1 - x0);
      px(x, y, f < 0.14 ? T.dd : f < 0.38 ? T.d : f < 0.86 ? T.m : T.l);
    }
  }
  /* neck join shadow, collarbone, chest crease */
  for (let x = 60; x <= 74; x++) px(x, 81, T.d);
  for (let x = 62; x <= 77; x++) px(x, 85 - ((x - 62) % 5 === 4 ? 1 : 0), T.d);
  for (let x = 66; x <= 79; x++) px(x, 101, T.d);
  for (let x = 68; x <= 77; x++) px(x, 100, T.m);
  /* hanging arms: capsule + fist, attached at the silhouette */
  const arm = (cxAt, sy, ey, w0, w1, tones, thumbSide) => {
    for (let y = sy; y <= ey; y++) {
      const t = (y - sy) / (ey - sy);
      const cx = cxAt(y);
      const w = w0 + (w1 - w0) * t;
      const x0 = Math.round(cx - w / 2), x1 = Math.round(cx + w / 2);
      for (let x = x0; x <= x1; x++) {
        const f = (x - x0) / Math.max(1, x1 - x0);
        let c = f < 0.2 ? tones[0] : f < 0.5 ? tones[1] : f < 0.85 ? tones[2] : tones[3];
        if (Math.abs(t - 0.42) < 0.018 && f > 0.25 && f < 0.9) c = tones[1]; /* elbow crease */
        px(x, y, c);
      }
    }
    const fy = ey + 1, fcx = Math.round(cxAt(ey));
    for (let y = fy; y <= fy + 8; y++) for (let dx = -4; dx <= 4; dx++) {
      const x = fcx + dx;
      if ((y === fy || y === fy + 8) && Math.abs(dx) > 2) continue;
      const f = (dx + 4) / 8;
      px(x, y, y >= fy + 6 ? tones[1] : f < 0.2 ? tones[0] : f < 0.8 ? tones[2] : tones[3]);
    }
    px(fcx + thumbSide * 4, fy + 2, tones[2]);
    px(fcx + thumbSide * 4, fy + 3, tones[1]);
    for (const dx of [-2, 0, 2]) px(fcx + dx, fy + 6, tones[0]);
  };
  /* near arm hugs the right edge; deltoid cap first */
  for (let y = 79; y <= 88; y++) {
    const w = 9 - Math.abs(y - 83.5);
    const cx = Math.round(xR(y)) + 1;
    for (let x = cx - Math.round(w / 2); x <= cx + Math.round(w / 2); x++)
      px(x, y, x > cx + 1 ? T.l : x > cx - 2 ? T.m : T.d);
  }
  arm((y) => xR(Math.min(y, 126)) + 2 - (y > 126 ? (y - 126) * 0.05 : 0), 88, 146, 8, 6, [T.d, T.m, T.m, T.l], 1);
  /* far arm follows the back's slope, in shadow */
  for (let y = 83; y <= 90; y++) {
    const cx = Math.round(xL(y)) - 1;
    for (let x = cx - 3; x <= cx + 3; x++) px(x, y, x < cx - 1 ? T.dd : T.d);
  }
  arm((y) => xL(Math.min(y, 126)) - 1 + (y > 126 ? (y - 126) * 0.02 : 0), 90, 138, 7, 5, [T.dd, T.d, T.d, T.m], -1);
  /* soften authored banding with checker dithering at tone boundaries,
     and close the white neck notch */
  const ramp = ["#a87952", "#c99465", "#e8b98a", "#f6d4a6"];
  const toneAt = (x, y) => {
    const i = (y * W + x) * 4;
    if (img.data[i + 3] < 128) return -1;
    const hex = "#" + [0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, "0")).join("");
    return ramp.indexOf(hex);
  };
  for (let y = 80; y <= 158; y++) for (let x = 38; x <= 96; x++) {
    if ((x + y) % 2) continue;
    const t = toneAt(x, y);
    if (t < 0) continue;
    const tr = toneAt(x + 1, y);
    if (tr >= 0 && Math.abs(tr - t) === 1) px(x, y, ramp[tr]);
  }
  for (let y = 74; y <= 82; y++) for (let x = 62; x <= 74; x++) {
    const i = (y * W + x) * 4;
    if (img.data[i + 3] < 128) {
      let solid = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const j = ((y + dy) * W + (x + dx)) * 4;
        if (img.data[j + 3] >= 128) solid++;
      }
      if (solid >= 2) px(x, y, T.m);
    }
  }
  writeFileSync(`${DIR}/kitsune-posed.png`, PNG.sync.write(img));
  console.log("kitsune-posed.png (fully authored upper body, dithered)");
} else if (cmd === "dress") {
  /* STEP 2: basic undergarments in neutral linen — the creator's chest
     wrap plus simple briefs, drawn deterministically over the posed donor
     with the same dithered banding. Output is the standing style
     reference, plus a 100x200 resample for bitforge (style_image must
     match the output size exactly). */
  const img = PNG.sync.read(readFileSync(`${DIR}/kitsune-posed.png`));
  const L = { d: "#aea28c", m: "#d9cbb0", l: "#ece2cd" };
  const px = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img.data[i] = parseInt(hex.slice(1, 3), 16);
    img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
    img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
    img.data[i + 3] = 255;
  };
  const solid = (x, y) => img.data[(y * W + x) * 4 + 3] >= 128;
  const xL = (y) => 48 + 8 * (y - 80) / 46, xR = (y) => 84 - 4 * (y - 80) / 46;
  /* chest wrap: rows 96-110 across the torso, under the near arm */
  for (let y = 96; y <= 110; y++) {
    const x0 = Math.round(xL(y)), x1 = Math.round(xR(y)) - 3;
    for (let x = x0; x <= x1; x++) {
      if (!solid(x, y)) continue;
      const f = (x - x0) / Math.max(1, x1 - x0);
      let c = f < 0.16 ? L.d : f < 0.85 ? L.m : L.l;
      if (y === 96 || y === 110) c = L.d;                     /* band edges */
      if ((x + y * 2) % 11 === 0 && y > 97 && y < 109) c = L.d; /* fold hints */
      px(x, y, c);
    }
  }
  /* briefs: rows 128-145 over the actual hip pixels, waistband on top */
  for (let y = 128; y <= 145; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 54; x <= 84; x++) if (solid(x, y)) { if (x0 < 0) x0 = x; x1 = x; }
    if (x0 < 0) continue;
    for (let x = x0; x <= x1; x++) {
      if (!solid(x, y)) continue;
      const f = (x - x0) / Math.max(1, x1 - x0);
      let c = f < 0.16 ? L.d : f < 0.85 ? L.m : L.l;
      if (y <= 129) c = L.l;                                   /* waistband */
      if (y >= 144) c = L.d;                                   /* leg hem */
      px(x, y, c);
    }
  }
  /* checker dither on the linen tone boundaries */
  const ramp = ["#aea28c", "#d9cbb0", "#ece2cd"];
  const toneAt = (x, y) => {
    const i = (y * W + x) * 4;
    if (img.data[i + 3] < 128) return -1;
    const hex = "#" + [0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, "0")).join("");
    return ramp.indexOf(hex);
  };
  for (let y = 96; y <= 145; y++) for (let x = 46; x <= 86; x++) {
    if ((x + y) % 2) continue;
    const t = toneAt(x, y);
    if (t < 0) continue;
    const tr = toneAt(x + 1, y);
    if (tr >= 0 && Math.abs(tr - t) === 1) px(x, y, ramp[tr]);
  }
  writeFileSync(`${DIR}/kitsune-styleref.png`, PNG.sync.write(img));
  /* 100x200 resample for bitforge */
  const st = new PNG({ width: 100, height: 200 });
  for (let y = 0; y < 200; y++) for (let x = 0; x < 100; x++) {
    const sx = Math.min(W - 1, Math.floor(((x + 0.5) / 100) * W));
    const sy = Math.min(H - 1, Math.floor(((y + 0.5) / 200) * H));
    const si = (sy * W + sx) * 4, di = (y * 100 + x) * 4;
    st.data[di] = img.data[si]; st.data[di + 1] = img.data[si + 1];
    st.data[di + 2] = img.data[si + 2]; st.data[di + 3] = img.data[si + 3] > 127 ? 255 : 0;
  }
  writeFileSync(`${DIR}/kitsune-styleref-100x200.png`, PNG.sync.write(st));
  console.log("kitsune-styleref.png + 100x200 resample written");
} else {
  console.log("usage: bald <seed> | skin <baldSeed> <seed> | finish <baseSeed> <seed> | spearless <seed> | repose <seed> | repose2 <seed> | repose3 <seed> | armfix <posed3Seed> | dress");
}