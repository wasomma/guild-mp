// Phase D resume, painterly probe: can the mannequin lane match the kitsune?
// Rolls a small style matrix — pixflux with an explicit painterly clause vs
// bitforge with the kitsune body as the style reference — across four probe
// subjects (human m/f mannequins, orc-m tusks, elf-f ears). Nothing here is
// pinned or dressed: the rolls feed the owner checkpoint gallery only.
// Run from the guild-mp root:
//   node scripts/art/gen-hero-probe.mjs roll            generate the full matrix
//   node scripts/art/gen-hero-probe.mjs roll px:human-f:2   one engine:subject:seed
//   node scripts/art/gen-hero-probe.mjs sheet           compose the judge sheet
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;
const DIR = "docs/art-src/heroes-d2";
const GEN_SIZE = { width: 128, height: 256 };
/* bitforge caps both dimensions at 200 (422 above it, like /inpaint) —
   the style lane rolls at 100x200 and production would need a 1.23x fit
   upscale to reach the kitsune's artH 246; flagged in the checkpoint */
const BF_SIZE = { width: 100, height: 200 };
const KITSUNE_RAW = "docs/art-src/kitsune-hd/body-s2.png";
const SKIN = ["#e8b98a", "#c99465"];
const PAL = [...SKIN, "#3a3644", "#2a2732", "#4a4656", "#2a2430"];

/* The proven Phase 7D bodysuit-mannequin clause, with the face rewritten
   toward the kitsune's painterly softness (the wave-2 rejection was
   photoreal-gaunt faces, not the mannequin idea itself). */
const SUIT = "wearing a snug plain dark-gray #3a3644 long-sleeved fitted bodysuit covering the torso and both arms to the wrists, matching fitted dark-gray #2a2732 leggings, plain dark simple boots, bare hands, both arms relaxed at the sides with hands in loose fists, well-drawn five-fingered hands, empty hands, no weapon";
const PAINT = "painted in a soft painterly anime-influenced style, soft cel shading with warm light, gentle rounded facial features, large expressive eyes, a calm slight smile, smooth soft skin";
const NEG = "hair, beard, helmet, hat, weapon, sword, axe, shield, armor, cape, deformed hands, extra fingers, extra limbs, muddy, blurry, photorealistic, gaunt face, hollow cheeks, harsh shadows, grim expression, wrinkles";

const SUBJECTS = {
  "human-m": {
    desc: `athletic young man standing in three-quarter view facing right, completely bald head, no hair, ${SUIT}, ${PAINT}, detailed shading`,
  },
  "human-f": {
    desc: `athletic young woman standing in three-quarter view facing right, her face and body turned toward the right side of the frame, completely bald head, no hair, ${SUIT}, ${PAINT}, detailed shading`,
  },
  "orc-m": {
    desc: `athletic young orc man standing in three-quarter view facing right, completely bald head, no hair, two small ivory tusks rising from his lower jaw, a strong friendly heavy jaw, ${SUIT}, ${PAINT}, detailed shading`,
  },
  "elf-f": {
    desc: `athletic young elf woman standing in three-quarter view facing right, her face and body turned toward the right side of the frame, completely bald head, no hair, long elegant pointed elf ears extending out to the sides, ${SUIT}, ${PAINT}, detailed shading`,
  },
};
const SEEDS = [1, 2];

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
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(path + " " + r.status + ": " + JSON.stringify(j).slice(0, 400));
  const b64 = j.image && j.image.base64;
  if (!b64) throw new Error(path + " no image in response: " + JSON.stringify(j).slice(0, 200));
  return { png: PNG.sync.read(Buffer.from(b64, "base64")), usage: j.usage };
}

const rawPath = (eng, sub, seed) => `${DIR}/${eng}-${sub}-s${seed}.png`;

async function rollOne(eng, sub, seed) {
  const out = rawPath(eng, sub, seed);
  if (existsSync(out)) { console.log("skip (exists)", out); return; }
  const cfg = SUBJECTS[sub];
  let res;
  if (eng === "px") {
    res = await call("/generate-image-pixflux", {
      description: cfg.desc, negative_description: NEG,
      image_size: GEN_SIZE, no_background: true,
      shading: "detailed shading", detail: "highly detailed", outline: "lineless",
      text_guidance_scale: 8,
      color_image: { type: "base64", base64: palPng(PAL) }, seed,
    });
  } else if (eng.startsWith("bf")) {
    /* bitforge requires the style image at exactly the output size;
       the bfn variants desaturate the reference first — the painterly
       shading is the style signal, the green/wine hues are content */
    const kraw = PNG.sync.read(readFileSync(KITSUNE_RAW));
    if (eng.startsWith("bfn")) {
      for (let i = 0; i < kraw.data.length; i += 4) {
        const g = Math.round(0.299 * kraw.data[i] + 0.587 * kraw.data[i + 1] + 0.114 * kraw.data[i + 2]);
        kraw.data[i] = kraw.data[i + 1] = kraw.data[i + 2] = g;
      }
    }
    const st = new PNG({ width: BF_SIZE.width, height: BF_SIZE.height });
    for (let y = 0; y < st.height; y++) for (let x = 0; x < st.width; x++) {
      const sx = Math.min(kraw.width - 1, Math.floor(((x + 0.5) / st.width) * kraw.width));
      const sy = Math.min(kraw.height - 1, Math.floor(((y + 0.5) / st.height) * kraw.height));
      const si = (sy * kraw.width + sx) * 4, di = (y * st.width + x) * 4;
      st.data[di] = kraw.data[si]; st.data[di + 1] = kraw.data[si + 1];
      st.data[di + 2] = kraw.data[si + 2]; st.data[di + 3] = kraw.data[si + 3];
    }
    const styleB64 = PNG.sync.write(st).toString("base64");
    const strength = Number(eng.replace(/^bfn?/, "")) || 60; /* bf/bfn + optional strength, default 60 */
    res = await call("/generate-image-bitforge", {
      description: cfg.desc, negative_description: NEG,
      image_size: BF_SIZE, no_background: true,
      style_image: { type: "base64", base64: styleB64 },
      style_strength: strength, seed,
    });
  }
  writeFileSync(out, PNG.sync.write(res.png));
  console.log("rolled", out, "usage", JSON.stringify(res.usage || {}));
}

function bbox(png) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3] > 127) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* judge sheet: every roll alpha-trimmed and scaled to the kitsune's own
   trimmed height, side by side with her raw — style is judged at eye level */
function sheet() {
  const kits = PNG.sync.read(readFileSync(KITSUNE_RAW));
  const kb = bbox(kits);
  const cells = [{ png: kits, b: kb, label: "KITSUNE" }];
  for (const eng of ["px", "bf", "bf40", "bf25", "bfn35"]) for (const sub of Object.keys(SUBJECTS)) for (const seed of SEEDS) {
    const p = rawPath(eng, sub, seed);
    if (!existsSync(p)) continue;
    const png = PNG.sync.read(readFileSync(p));
    cells.push({ png, b: bbox(png), label: `${eng}-${sub}-s${seed}` });
  }
  const H = kb.h, PAD = 8, LABEL = 12;
  const widths = cells.map((c) => Math.round((c.b.w * H) / c.b.h));
  const W = widths.reduce((a, w) => a + w + PAD, PAD);
  const out = new PNG({ width: W, height: H + PAD * 2 + LABEL });
  out.data.fill(0);
  for (let i = 0, x = PAD; i < cells.length; x += widths[i] + PAD, i++) {
    const { png, b } = cells[i], tw = widths[i];
    for (let y = 0; y < H; y++) for (let xx = 0; xx < tw; xx++) {
      const sx = b.x0 + Math.min(b.w - 1, Math.floor(((xx + 0.5) / tw) * b.w));
      const sy = b.y0 + Math.min(b.h - 1, Math.floor(((y + 0.5) / H) * b.h));
      const si = (sy * png.width + sx) * 4, di = ((y + PAD) * W + x + xx) * 4;
      out.data[di] = png.data[si]; out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2]; out.data[di + 3] = png.data[si + 3];
    }
  }
  writeFileSync(`${DIR}/judge-sheet.png`, PNG.sync.write(out));
  console.log("sheet:", `${DIR}/judge-sheet.png`, W + "x" + (H + PAD * 2 + LABEL), "cells:", cells.map((c) => c.label).join(","));
}

const [cmd, only] = process.argv.slice(2);
if (cmd === "roll") {
  const filter = only ? only.split(":") : null;
  for (const eng of ["px", "bf", "bf40", "bf25", "bfn35"]) for (const sub of Object.keys(SUBJECTS)) for (const seed of SEEDS) {
    if (filter && !(filter[0] === eng && filter[1] === sub && Number(filter[2]) === seed)) continue;
    try { await rollOne(eng, sub, seed); }
    catch (e) { console.error("FAIL", eng, sub, "s" + seed, e.message); }
  }
} else if (cmd === "sheet") {
  sheet();
} else {
  console.log("usage: roll [eng:sub:seed] | sheet");
}
