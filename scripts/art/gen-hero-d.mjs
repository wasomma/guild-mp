// Phase D hero generator: class base bodies + wardrobe overlay layers.
// The overlay trick: every wardrobe item is INPAINTED onto the pinned base
// body roll, then pixel-diffed against it — the overlay fits the body by
// construction. All layers for a body ship on one uniform fitted canvas
// (the full 128x256 gen canvas resampled by the base body's fit scale), so
// the engine draws every layer at the same dest rect with one anchor set.
// Run from the guild-mp root:
//   node scripts/art/gen-hero-d.mjs body <bodyId> <seed>      roll a base candidate
//   node scripts/art/gen-hero-d.mjs pick <bodyId> <seed>      pin a roll as the base (writes -base.png + -meta.json)
//   node scripts/art/gen-hero-d.mjs wear <bodyId> <slot> <itemId> <seed>   inpaint + diff-extract an overlay
//   node scripts/art/gen-hero-d.mjs weapon <styleId> <seed>   standalone weapon sprite (Steel ramp)
// Raws + working files in docs/art-src/heroes-d/; nothing is written to
// client/public/assets until a layer is promoted by hand at ship time.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;
const DIR = "docs/art-src/heroes-d";
const GEN = { w: 128, h: 256 };
const GEN_SIZE = { width: GEN.w, height: GEN.h };
const SKIN = ["#e8b98a", "#c99465"];

/* Base bodies: bald, canon skin, snug neutral underclothes (dark, so any
   outfit overlay covers them), loose fists at the sides, NO weapon. artH
   normalizes hero height across rolls (kitsune canon 246 = ~123 logical). */
const BODY_CFG = {
  "tank-m": {
    artH: 246,
    pal: [...SKIN, "#3a3644", "#2a2732", "#4a4656", "#2a2430"],
    desc: "tall broad-shouldered muscular bald man standing in three-quarter view facing right, completely bald head, no hair, heavy powerful build with thick arms, wearing a snug plain dark-gray #3a3644 long-sleeved fitted bodysuit covering the torso and both arms to the wrists, matching fitted dark-gray #2a2732 leggings, plain dark simple boots, bare hands, both arms relaxed at his sides with hands in loose fists, well-drawn five-fingered hands, calm determined face, empty hands, no weapon, detailed shading",
    neg: "hair, beard, helmet, hat, weapon, sword, axe, shield, armor, cape, deformed hands, extra fingers, extra limbs, muddy, blurry",
  },
  "tank-f": {
    artH: 240,
    pal: [...SKIN, "#3a3644", "#2a2732", "#4a4656", "#2a2430"],
    desc: "tall athletic strong woman standing in three-quarter view facing right, her face and body turned toward the right side of the frame, completely bald head, no hair, smooth even skin, broad-shouldered powerful but tapered build, wearing a snug plain dark-gray #3a3644 long-sleeved fitted bodysuit covering the torso and both arms to the wrists, matching fitted dark-gray #2a2732 leggings, plain dark simple boots, bare hands, both arms relaxed at her sides with hands in loose fists, well-drawn five-fingered hands, calm determined face, empty hands, no weapon, detailed shading",
    neg: "hair, beard, helmet, hat, weapon, sword, axe, shield, armor, cape, deformed hands, extra fingers, extra limbs, muddy, blurry",
  },
};

/* Wardrobe items. mask: rows of the raw gen the inpaint may repaint, given
   the base bbox (t=top, n=neck, w=waist, f=feet from the body meta).
   Outfits repaint neck-to-feet; hair repaints the head box, deeper for
   styles that fall past the shoulders. Hair is generated SILVER-GRAY —
   the engine tints it to the 9 catalog colors at runtime. */
const WEAR_CFG = {
  outfit: {
    0: { name: "Traveler", pal: ["#4d5a8a", "#3a4468", "#6b79ad", "#2a2430"],
      desc: "wearing a medieval fantasy slate-blue #4d5a8a adventurer's traveling outfit that fully covers the torso and both arms: long-sleeved slate-blue fabric tunic reaching mid-thigh, sturdy trousers, leather belt, tall leather boots, practical worn fabric, the tunic completely covers the chest and shoulders and arms in slate-blue cloth, detailed shading" },
    3: { name: "Midnight", pal: ["#33304f", "#221f38", "#4a4670", "#8d87a3"],
      desc: "wearing a medieval fantasy deep midnight-purple #33304f guard uniform that fully covers the torso and both arms: long-sleeved fitted midnight-purple fabric tunic with pale lavender #8d87a3 trim at the collar and cuffs, dark trousers, dark leather boots, the tunic completely covers the chest and shoulders and arms in dark cloth, detailed shading" },
    4: { name: "Royal", pal: ["#6a4a9e", "#4e3675", "#8a6ac0", "#f2c14e"],
      desc: "wearing a medieval fantasy regal royal-purple #6a4a9e noble outfit that fully covers the torso and both arms: long-sleeved fine royal-purple fabric tunic with gold #f2c14e trim and a gold sash across the chest, dark trousers, polished boots, the tunic completely covers the chest and shoulders and arms in purple cloth, detailed shading" },
    neg: "futuristic, sci-fi, techwear, armor plates, zippers, bare chest, shirtless, exposed torso, bare arms, bare shoulders, exposed biceps, skin on the arms, sleeveless, tank top, bracers over bare skin, muscles visible, undershirt",
    guidance: 10,
    mask: (m) => ({ y0: m.neckY, y1: GEN.h - 1, pad: 8 }),
  },
  hairstyle: {
    short: { name: "Short Crop", depth: 0,
      desc: "with thick short-cropped silver-gray hair #b8b8c2 covering the whole scalp, neat practical short haircut, detailed shading" },
    pixie: { name: "Pixie Cut", depth: 0,
      desc: "with a silver-gray #b8b8c2 pixie cut, short tousled hair with a soft side-swept fringe covering the scalp, detailed shading" },
    bob: { name: "Sleek Bob", depth: 0.1,
      desc: "with a sleek chin-length silver-gray #b8b8c2 bob haircut, smooth rounded hair covering the scalp and framing the face, detailed shading" },
    pony: { name: "Ponytail", depth: 0.35,
      desc: "with silver-gray #b8b8c2 hair tied in a high ponytail falling behind the head to shoulder-blade length, hair covering the scalp, detailed shading" },
    long: { name: "Long Flow", depth: 0.45,
      desc: "with long flowing silver-gray #b8b8c2 hair covering the scalp and falling loose past the shoulders down the back, detailed shading" },
    pal: ["#b8b8c2", "#8f8f9c", "#dcdce4", "#6a6a78"],
    neg: "muddy, blurry, deformed",
    bodyClause: "wearing a snug plain dark-gray #3a3644 long-sleeved fitted bodysuit",
    mask: (m, item) => ({
      y0: Math.max(0, m.topY - 10),
      y1: Math.round(m.neckY + (m.footY - m.neckY) * (item.depth || 0)) + 8,
      pad: 14,
      headOnly: true,
    }),
  },
};

/* Weapons: generated once in the Steel ramp; the engine ramp-swaps the
   other skins. Authored upright, the engine rotates/animates. */
const WEAPON_CFG = {
  warrior: {
    gen: { w: 64, h: 128 }, artH: 112,
    pal: ["#cfd6e0", "#7f8aa0", "#eef2f8", "#ffffff", "#6b4a32", "#513723", "#8a6b48"],
    desc: "single one-handed battle axe standing upright, broad curved steel axe head #cfd6e0 with bright polished edge #eef2f8 on one side near the top, sturdy dark wooden handle #6b4a32 with leather grip wrap, side view, nothing else in frame, detailed shading",
    neg: "hand, arm, person, double-headed, two blades, muddy, dark, blurry",
  },
};

const args = process.argv.slice(2);
const cmd = args[0];
mkdirSync(DIR, { recursive: true });

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

async function call(path, body) {
  const r = await fetch("https://api.pixellab.ai/v1" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) { console.log(path, "HTTP", r.status, txt.slice(0, 400)); process.exit(1); }
  const j = JSON.parse(txt);
  return { png: PNG.sync.read(Buffer.from(j.image.base64.replace(/^data:image\/png;base64,/, ""), "base64")), usage: j.usage };
}

function bbox(png) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++)
    if (png.data[(y * png.width + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* Resample the FULL gen canvas by scale s (hard alpha, nearest) — every
   layer of a body goes through the identical transform, so they align. */
function fitCanvas(png, s) {
  const tw = Math.round(GEN.w * s), th = Math.round(GEN.h * s);
  const out = new PNG({ width: tw, height: th });
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const sx = Math.min(GEN.w - 1, Math.floor(((x + 0.5) / tw) * GEN.w));
    const sy = Math.min(GEN.h - 1, Math.floor(((y + 0.5) / th) * GEN.h));
    const si = (sy * png.width + sx) * 4, di = (y * tw + x) * 4;
    out.data[di] = png.data[si]; out.data[di + 1] = png.data[si + 1];
    out.data[di + 2] = png.data[si + 2]; out.data[di + 3] = png.data[si + 3] > 127 ? 255 : 0;
  }
  return out;
}

const rawPath = (bodyId, seed) => `${DIR}/${bodyId}-body-s${seed}.png`;
const metaPath = (bodyId) => `${DIR}/${bodyId}-meta.json`;

if (cmd === "body") {
  const [, bodyId, seedArg] = args;
  const cfg = BODY_CFG[bodyId];
  if (!cfg) throw new Error("bodyId must be: " + Object.keys(BODY_CFG).join(" | "));
  const seed = Number(seedArg) || 1;
  const { png, usage } = await call("/generate-image-pixflux", {
    description: cfg.desc, negative_description: cfg.neg,
    image_size: GEN_SIZE, no_background: true,
    shading: "detailed shading", detail: "highly detailed", outline: "lineless",
    text_guidance_scale: 8,
    color_image: { type: "base64", base64: palPng(cfg.pal) }, seed,
  });
  writeFileSync(rawPath(bodyId, seed), PNG.sync.write(png));
  const b = bbox(png);
  console.log(bodyId, "seed", seed, "bbox", JSON.stringify(b), "usage", JSON.stringify(usage || {}));
} else if (cmd === "pick") {
  const [, bodyId, seedArg] = args;
  const cfg = BODY_CFG[bodyId];
  const seed = Number(seedArg);
  const raw = PNG.sync.read(readFileSync(rawPath(bodyId, seed)));
  const b = bbox(raw);
  const s = cfg.artH / b.h;
  const fitted = fitCanvas(raw, s);
  const fb = bbox(fitted);
  writeFileSync(`${DIR}/${bodyId}-base.png`, PNG.sync.write(fitted));
  /* neckY/topY/handX/handY are raw-space rows/cols supplied by hand in the
     meta after inspecting the pinned roll (see README) — seed them with
     estimates from the bbox so wear can run before the eyeball pass. */
  const prev = existsSync(metaPath(bodyId)) ? JSON.parse(readFileSync(metaPath(bodyId), "utf8")) : {};
  const meta = {
    seed, s, artH: cfg.artH,
    raw: b, out: { w: fitted.width, h: fitted.height, cx: Math.round((fb.x0 + fb.x1) / 2), foot: fb.y1 },
    topY: prev.topY ?? b.y0, neckY: prev.neckY ?? Math.round(b.y0 + b.h * 0.14),
    footY: prev.footY ?? b.y1, hand: prev.hand ?? null,
  };
  writeFileSync(metaPath(bodyId), JSON.stringify(meta, null, 2));
  console.log("pinned", bodyId, "seed", seed, "->", fitted.width + "x" + fitted.height, "meta", JSON.stringify(meta));
} else if (cmd === "wear") {
  const [, bodyId, slot, itemId, seedArg] = args;
  const slotCfg = WEAR_CFG[slot];
  const item = slotCfg && slotCfg[itemId];
  if (!item) throw new Error("unknown " + slot + " item: " + itemId);
  const meta = JSON.parse(readFileSync(metaPath(bodyId), "utf8"));
  const raw = PNG.sync.read(readFileSync(rawPath(bodyId, meta.seed)));
  const seed = Number(seedArg) || 1;
  const mr = slotCfg.mask(meta, item);
  const person = bodyId.endsWith("-f") ? "woman" : "man";
  const bodyDesc = slot === "hairstyle"
    ? person + " " + item.desc + ", standing in three-quarter view facing right, " + (slotCfg.bodyClause || "fully clothed")
    : "bald " + person + " standing in three-quarter view facing right, " + (slotCfg.bodyClause || "fully clothed");
  /* head bbox of the base roll — hair masks confine to these columns so the
     inpaint can't redress the torso */
  let hx0 = GEN.w, hx1 = 0;
  for (let y = meta.topY; y <= meta.neckY; y++) for (let x = 0; x < GEN.w; x++)
    if (raw.data[(y * GEN.w + x) * 4 + 3] > 8) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  /* /inpaint caps at 200x200 — repaint the mask range through <=200-row
     windows, each cropped with already-dressed context above the seam and
     pasted back before the next window runs. */
  const WIN = 200, CTX = 40;
  const res = new PNG({ width: GEN.w, height: GEN.h });
  raw.data.copy(res.data);
  let usage = 0, passN = 0;
  const cropRows = (png, ws) => {
    const c = new PNG({ width: GEN.w, height: WIN });
    png.data.copy(c.data, 0, ws * GEN.w * 4, (ws + WIN) * GEN.w * 4);
    return c;
  };
  const inpaintRows = async (rowY0, rowY1) => {
    /* one windowed inpaint over global rows rowY0..rowY1 (must fit WIN) */
    const ws = Math.max(0, Math.min(rowY0 - CTX, GEN.h - WIN));
    const winMask = new PNG({ width: GEN.w, height: WIN });
    for (let y = 0; y < WIN; y++) for (let x = 0; x < GEN.w; x++) {
      const gy = ws + y;
      const mx0 = mr.headOnly ? hx0 - mr.pad : meta.raw.x0 - mr.pad;
      const mx1 = mr.headOnly ? hx1 + mr.pad : meta.raw.x1 + mr.pad;
      const inside = gy >= rowY0 && gy <= rowY1 && x >= mx0 && x <= mx1;
      const i = (y * GEN.w + x) * 4;
      winMask.data[i] = winMask.data[i + 1] = winMask.data[i + 2] = inside ? 255 : 0;
      winMask.data[i + 3] = 255;
    }
    const { png: winRes, usage: u } = await call("/inpaint", {
      description: slot === "hairstyle" ? bodyDesc : bodyDesc + ", " + item.desc,
      negative_description: slotCfg.neg || "muddy, blurry, deformed",
      image_size: { width: GEN.w, height: WIN },
      inpainting_image: { type: "base64", base64: PNG.sync.write(cropRows(res, ws)).toString("base64") },
      mask_image: { type: "base64", base64: PNG.sync.write(winMask).toString("base64") },
      color_image: { type: "base64", base64: palPng([...BODY_CFG[bodyId].pal, ...(item.pal || slotCfg.pal || [])]) },
      no_background: true,
      shading: "detailed shading", detail: "highly detailed", outline: "lineless",
      text_guidance_scale: slotCfg.guidance || 8,
      seed: seed + passN,
    });
    winRes.data.copy(res.data, ws * GEN.w * 4);
    usage += (u && u.usd) || 0;
    passN++;
  };
  const seams = [];
  if (process.env.REEXTRACT === "1") {
    /* re-run fit/diff/cleanup from the saved inpaint raw, no API calls */
    const saved = PNG.sync.read(readFileSync(`${DIR}/${bodyId}-${slot}-${itemId}-s${seed}.png`));
    saved.data.copy(res.data);
  } else
  for (let a = mr.y0; a <= mr.y1; ) {
    const ws = Math.max(0, Math.min(a - CTX, GEN.h - WIN));
    const mEnd = Math.min(mr.y1, ws + WIN - 1);
    await inpaintRows(a, mEnd);
    if (mEnd < mr.y1) seams.push(mEnd + 1);
    a = mEnd + 1;
  }
  /* window seams get the ground-strip treatment: re-inpaint a thin band
     across each boundary so the two passes blend */
  for (const sy of seams) await inpaintRows(sy - 12, sy + 12);
  const tag = `${bodyId}-${slot}-${itemId}-s${seed}`;
  writeFileSync(`${DIR}/${tag}.png`, PNG.sync.write(res));
  /* fit with the base transform, then diff-extract the overlay */
  const fitted = fitCanvas(res, meta.s);
  const base = PNG.sync.read(readFileSync(`${DIR}/${bodyId}-base.png`));
  const ov = new PNG({ width: base.width, height: base.height });
  let kept = 0;
  for (let i = 0; i < base.width * base.height; i++) {
    const o = i * 4;
    if (fitted.data[o + 3] < 128) continue;
    const dr = fitted.data[o] - base.data[o], dg = fitted.data[o + 1] - base.data[o + 1], db = fitted.data[o + 2] - base.data[o + 2];
    if (slot === "hairstyle") {
      /* face guard: never let hair pixels land on the lower front of the
         face (jaw, mouth, chin) — that is where inpaint grows beards. Deep
         styles (hair falling past the neck) get stricter rules: the beard
         band clips to the back quarter of the head, and below the neck only
         the behind-the-head third survives (kills repainted collars). */
      const x = (i % base.width) / meta.s, y = Math.floor(i / base.width) / meta.s;
      const headH = meta.neckY - meta.topY, headW = hx1 - hx0;
      const deep = (item.depth || 0) > 0;
      const faceX = deep ? hx0 + headW * 0.25 : (hx0 + hx1) / 2;
      if (y > meta.topY + headH * 0.52 && y < meta.neckY + 6 && x > faceX) continue;
      if (deep && y >= meta.neckY + 6 && x > hx0 + headW * 0.35) continue;
      /* hair is generated silver-gray — keep only near-neutral pixels, so a
         repainted face or collar can't leak into the (runtime-tinted) hair
         layer and hairstyles never change the face */
      const r = fitted.data[o], g = fitted.data[o + 1], bl = fitted.data[o + 2];
      const chroma = Math.max(Math.abs(r - g), Math.abs(g - bl), Math.abs(r - bl));
      if (chroma > 30) continue;
    }
    if (base.data[o + 3] < 128 || Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 24) {
      ov.data[o] = fitted.data[o]; ov.data[o + 1] = fitted.data[o + 1];
      ov.data[o + 2] = fitted.data[o + 2]; ov.data[o + 3] = 255; kept++;
    }
  }
  /* drop stray components: overlay pixels must connect (8-way, through the
     overlay) to something touching the base body's alpha — windowed inpaint
     occasionally paints floating debris near the silhouette edge */
  {
    const W2 = base.width, H2 = base.height;
    const idx = (x, y) => y * W2 + x;
    const lab = new Int32Array(W2 * H2).fill(-1);
    const comps = [];
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      if (ov.data[idx(x, y) * 4 + 3] === 0 || lab[idx(x, y)] !== -1) continue;
      const id = comps.length, stack = [[x, y]];
      let touches = false, px = [];
      lab[idx(x, y)] = id;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        px.push(idx(cx, cy));
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2) continue;
          if (base.data[idx(nx, ny) * 4 + 3] > 0) touches = true;
          if (ov.data[idx(nx, ny) * 4 + 3] > 0 && lab[idx(nx, ny)] === -1) {
            lab[idx(nx, ny)] = id; stack.push([nx, ny]);
          }
        }
      }
      comps.push({ touches, px });
    }
    for (const c of comps) if (!c.touches) for (const i of c.px) { ov.data[i * 4 + 3] = 0; kept--; }
  }
  writeFileSync(`${DIR}/${tag}-overlay.png`, PNG.sync.write(ov));
  /* judge composite: base + overlay */
  const check = new PNG({ width: base.width, height: base.height });
  base.data.copy(check.data);
  for (let i = 0; i < base.width * base.height; i++) {
    const o = i * 4;
    if (ov.data[o + 3] > 0) { check.data[o] = ov.data[o]; check.data[o + 1] = ov.data[o + 1]; check.data[o + 2] = ov.data[o + 2]; check.data[o + 3] = 255; }
  }
  writeFileSync(`${DIR}/${tag}-check.png`, PNG.sync.write(check));
  console.log(tag, ": overlay px", kept, "mask rows", mr.y0 + ".." + mr.y1, "passes", passN, "usd", usage.toFixed(4));
} else if (cmd === "weapon") {
  const [, styleId, seedArg] = args;
  const cfg = WEAPON_CFG[styleId];
  if (!cfg) throw new Error("styleId must be: " + Object.keys(WEAPON_CFG).join(" | "));
  const seed = Number(seedArg) || 1;
  const { png, usage } = await call("/generate-image-pixflux", {
    description: cfg.desc, negative_description: cfg.neg,
    image_size: { width: cfg.gen.w, height: cfg.gen.h }, no_background: true,
    shading: "detailed shading", detail: "highly detailed", outline: "lineless",
    text_guidance_scale: 8,
    color_image: { type: "base64", base64: palPng(cfg.pal) }, seed,
  });
  writeFileSync(`${DIR}/weapon-${styleId}-s${seed}.png`, PNG.sync.write(png));
  const b = bbox(png);
  /* trim + resample to artH like fit-enemy (weapons ship trimmed — they
     have their own anchor, not the body canvas) */
  const th = cfg.artH, tw = Math.max(1, Math.round((b.w / b.h) * th));
  const out = new PNG({ width: tw, height: th });
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const sx = b.x0 + Math.min(b.w - 1, Math.floor(((x + 0.5) / tw) * b.w));
    const sy = b.y0 + Math.min(b.h - 1, Math.floor(((y + 0.5) / th) * b.h));
    const si = (sy * png.width + sx) * 4, di = (y * tw + x) * 4;
    out.data[di] = png.data[si]; out.data[di + 1] = png.data[si + 1];
    out.data[di + 2] = png.data[si + 2]; out.data[di + 3] = png.data[si + 3] > 127 ? 255 : 0;
  }
  writeFileSync(`${DIR}/weapon-${styleId}-fitted.png`, PNG.sync.write(out));
  console.log("weapon", styleId, "seed", seed, "raw bbox", JSON.stringify(b), "-> fitted", tw + "x" + th, "usage", JSON.stringify(usage || {}));
} else {
  throw new Error("cmd must be: body | pick | wear | weapon");
}
