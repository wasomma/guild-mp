// T-pose character sheets (owner redirect, 2026-07-24): brand-new human
// characters in undergarments, T-pose, front + back view side by side on
// one canvas — a chooser series in both genders. Lanes: pixflux with the
// painterly clause, and bitforge with the kitsune raw as style reference.
// Run from the guild-mp root:
//   node scripts/art/gen-tpose.mjs roll <lane>:<sub>:<seed>   e.g. px:human-f:1
//   node scripts/art/gen-tpose.mjs sheet                      compose the chooser
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;
const DIR = "docs/art-src/heroes-d2/tpose";
const KITSUNE_RAW = "docs/art-src/kitsune-hd/body-s2.png";
const PX_SIZE = { width: 256, height: 256 };
const BF_SIZE = { width: 200, height: 200 }; /* bitforge hard cap */
const PAL = ["#e8b98a", "#c99465", "#f6d4a6", "#a87952", "#d9cbb0", "#aea28c", "#ece2cd"];

const PAINT = "soft painterly anime-influenced style, soft cel shading with warm light, gentle rounded facial features, calm neutral expression, smooth soft skin";
const NEG_BASE = "hair, beard, helmet, hat, weapon, clothing, armor, shoes, boots, photorealistic, gaunt face, hollow cheeks, harsh shadows, muddy, blurry, deformed hands, extra fingers, extra limbs, three views, side view, earrings, jewelry, necklace, signature, watermark, text, chibi, child";
const NEG = NEG_BASE; /* soft-* subjects get SOFT_NEG appended at call time */
const FEM_NEG = ", nudity"; /* NO chest/top tokens: negatives are non-compositional and "bare chest" deleted the chest WRAP */

/* the "soft" variants push harder toward the kitsune's painterly softness
   and away from the anatomical-illustration read of the base lane */
const SOFT = "in the style of a warm storybook illustration, soft rounded gentle anatomy, smooth simple shading with no harsh muscle definition, cute friendly face";
const SOFT_NEG = ", six-pack abs, defined muscles, muscular definition, anatomical detail, veins, ribs";
const SUBJECTS = {
  "human-m": `pixel art character reference sheet of one young athletic man shown twice side by side, LEFT figure is the front view and RIGHT figure is the back view of the same character, both standing in a T-pose with arms stretched straight out horizontally and legs together, completely bald head, no hair, wearing only simple plain linen #d9cbb0 fitted underwear shorts, bare chest, barefoot, ${PAINT}, detailed shading`,
  "human-f": `pixel art character reference sheet of one young athletic woman shown twice side by side, LEFT figure is the front view and RIGHT figure is the back view of the same character, both standing in a T-pose with arms stretched straight out horizontally and legs together, completely bald head, no hair, wearing a plain linen #d9cbb0 bandeau wrap top and fitted linen briefs, barefoot, ${PAINT}, detailed shading`,
};
SUBJECTS["soft-m"] = SUBJECTS["human-m"].replace(PAINT, PAINT + ", " + SOFT);
SUBJECTS["soft-f"] = SUBJECTS["human-f"].replace(PAINT, PAINT + ", " + SOFT);
/* race variants (owner picks per race like the human chooser). Style lanes
   follow the human picks: fem = base lane, masc = soft lane. Learnings
   baked in: "completely human face" or fox-kin goes anthro; orcs need the
   explicit warm-skin clause or they drift gray-green; dwarves beardless
   (beards are tintable hair overlays). */
const RACE_FLAVOR = {
  elf: ["handsome graceful young elf man with a slender elegant athletic build and small subtle pointed ears", "elf woman with long elegant pointed ears extending out to the sides"],
  kitsunekin: ["tall adult man with mature adult proportions and a completely human face with clear eyes, a completely bald head with no hair at all, only two upright gray furred fox ears growing from the top of the bare scalp", "woman with a completely human face with clear eyes, a completely bald head with no hair at all, only two upright gray furred fox ears growing from the top of the bare scalp"],
  dwarf: ["short stocky powerfully built dwarf man with broad shoulders", "short stocky sturdily built dwarf woman with broad shoulders, wide hips, and a strong heavy build"],
  orc: ["orc man with two small ivory tusks rising from his lower jaw and the same warm golden human skin tone", "orc woman with two small ivory tusks rising from her lower jaw and the same warm golden human skin tone"],
  tiefling: ["tiefling man with two dark burgundy curved horns sweeping back from his temples", "tiefling woman with two dark burgundy curved horns sweeping back from his temples"],
};
for (const [race, [mF, fF]] of Object.entries(RACE_FLAVOR)) {
  SUBJECTS[race + "-m"] = SUBJECTS["soft-m"].replace("young athletic man", mF);
  SUBJECTS[race + "-f"] = SUBJECTS["human-f"].replace("young athletic woman", fF);
}

mkdirSync(DIR, { recursive: true });

const palPng = (cols) => {
  const p = new PNG({ width: cols.length, height: 1 });
  cols.forEach((h, i) => {
    p.data[i * 4] = parseInt(h.slice(1, 3), 16);
    p.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
    p.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
    p.data[i * 4 + 3] = 255;
  });
  return PNG.sync.write(p).toString("base64");
};

async function call(path, body) {
  const r = await fetch("https://api.pixellab.ai/v1" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(path + " " + r.status + ": " + JSON.stringify(j).slice(0, 300));
  return { png: PNG.sync.read(Buffer.from(j.image.base64, "base64")), usage: j.usage };
}

function kitsuneRefAt(w, h) {
  const kraw = PNG.sync.read(readFileSync(KITSUNE_RAW));
  const st = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(kraw.width - 1, Math.floor(((x + 0.5) / w) * kraw.width));
    const sy = Math.min(kraw.height - 1, Math.floor(((y + 0.5) / h) * kraw.height));
    const si = (sy * kraw.width + sx) * 4, di = (y * w + x) * 4;
    st.data[di] = kraw.data[si]; st.data[di + 1] = kraw.data[si + 1];
    st.data[di + 2] = kraw.data[si + 2]; st.data[di + 3] = kraw.data[si + 3];
  }
  return PNG.sync.write(st).toString("base64");
}

async function rollOne(lane, sub, seed) {
  const out = `${DIR}/${lane}-${sub}-s${seed}.png`;
  if (existsSync(out)) { console.log("skip (exists)", out); return; }
  const desc = SUBJECTS[sub];
  if (!desc) throw new Error("subject must be: " + Object.keys(SUBJECTS).join(" | "));
  let res;
  if (lane === "px") {
    let neg = sub.startsWith("soft") || !sub.startsWith("human") ? NEG_BASE + SOFT_NEG : NEG_BASE;
    if (sub.endsWith("-f")) neg += FEM_NEG;
    res = await call("/generate-image-pixflux", {
      description: desc, negative_description: neg,
      image_size: PX_SIZE, no_background: true,
      shading: "detailed shading", detail: "highly detailed", outline: "lineless",
      text_guidance_scale: 8,
      color_image: { type: "base64", base64: palPng(PAL) }, seed,
    });
  } else if (lane.startsWith("bf")) {
    const strength = Number(lane.slice(2)) || 35;
    res = await call("/generate-image-bitforge", {
      description: desc, negative_description: NEG,
      image_size: BF_SIZE, no_background: true,
      style_image: { type: "base64", base64: kitsuneRefAt(BF_SIZE.width, BF_SIZE.height) },
      style_strength: strength, seed,
    });
  } else throw new Error("lane must be px or bf<strength>");
  writeFileSync(out, PNG.sync.write(res.png));
  console.log("rolled", out, "usage", JSON.stringify(res.usage || {}));
}

function sheet() {
  const cells = [];
  for (const f of require("node:fs").readdirSync(DIR).sort()) {
    if (!f.endsWith(".png") || f === "chooser.png") continue;
    cells.push({ name: f.replace(".png", ""), png: PNG.sync.read(readFileSync(`${DIR}/${f}`)) });
  }
  const CH = Math.max(...cells.map((c) => c.png.height)), PAD = 10;
  const W = cells.reduce((a, c) => a + c.png.width + PAD, PAD);
  const out = new PNG({ width: W, height: CH + PAD * 2 });
  out.data.fill(0);
  let x0 = PAD;
  for (const c of cells) {
    for (let y = 0; y < c.png.height; y++) for (let x = 0; x < c.png.width; x++) {
      const si = (y * c.png.width + x) * 4, di = ((y + PAD) * W + x0 + x) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = c.png.data[si + k];
    }
    x0 += c.png.width + PAD;
  }
  writeFileSync(`${DIR}/chooser.png`, PNG.sync.write(out));
  console.log("chooser:", `${DIR}/chooser.png`, W + "x" + (CH + PAD * 2), "cells:", cells.map((c) => c.name).join(","));
}

/* fit <rollFile> <outStem> <artH>: key out the card background (flood
   fill from the borders, so enclosed linen tones survive), split into the
   left (front) and right (back) figures, alpha-trim each, hard-alpha
   resample to artH, save <outStem>-front.png / <outStem>-back.png. */
function fit(rollFile, outStem, artH) {
  const img = PNG.sync.read(readFileSync(`${DIR}/${rollFile}.png`));
  const { width: W2, height: H2 } = img;
  const bgAt = (x, y) => {
    const i = (y * W2 + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  const corners = [[0, 0], [W2 - 1, 0], [0, H2 - 1], [W2 - 1, H2 - 1]];
  const seen = new Uint8Array(W2 * H2);
  const stack = [];
  for (const [cx, cy] of corners) {
    const ref = bgAt(cx, cy);
    stack.push([cx, cy, ref]);
  }
  while (stack.length) {
    const [x, y, ref] = stack.pop();
    if (x < 0 || y < 0 || x >= W2 || y >= H2) continue;
    const idx = y * W2 + x;
    if (seen[idx]) continue;
    const [r, g, b] = bgAt(x, y);
    if (Math.abs(r - ref[0]) + Math.abs(g - ref[1]) + Math.abs(b - ref[2]) > 60) continue;
    seen[idx] = 1;
    img.data[idx * 4 + 3] = 0;
    stack.push([x + 1, y, ref], [x - 1, y, ref], [x, y + 1, ref], [x, y - 1, ref]);
  }
  /* split at the widest all-transparent column gap in the middle half */
  const colSolid = new Array(W2).fill(0);
  for (let x = 0; x < W2; x++) for (let y = 0; y < H2; y++) if (img.data[(y * W2 + x) * 4 + 3] >= 128) colSolid[x]++;
  let best = { len: 0, mid: W2 / 2 };
  let runStart = -1;
  for (let x = Math.round(W2 * 0.25); x <= Math.round(W2 * 0.75); x++) {
    if (colSolid[x] === 0) { if (runStart < 0) runStart = x; }
    else if (runStart >= 0) {
      const len = x - runStart;
      if (len > best.len) best = { len, mid: Math.round((runStart + x) / 2) };
      runStart = -1;
    }
  }
  const halves = [[0, best.mid, "front"], [best.mid, W2, "back"]];
  for (const [x0, x1, tag] of halves) {
    let bx0 = x1, by0 = H2, bx1 = -1, by1 = -1;
    for (let y = 0; y < H2; y++) for (let x = x0; x < x1; x++) {
      if (img.data[(y * W2 + x) * 4 + 3] >= 128) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
    }
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    const s = artH / bh;
    const tw = Math.round(bw * s), th = artH;
    const out = new PNG({ width: tw, height: th });
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const sx = bx0 + Math.min(bw - 1, Math.floor(((x + 0.5) / tw) * bw));
      const sy = by0 + Math.min(bh - 1, Math.floor(((y + 0.5) / th) * bh));
      const si = (sy * W2 + sx) * 4, di = (y * tw + x) * 4;
      out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1];
      out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = img.data[si + 3] > 127 ? 255 : 0;
    }
    writeFileSync(`${DIR}/${outStem}-${tag}.png`, PNG.sync.write(out));
    console.log(`${outStem}-${tag}.png ${tw}x${th} (split at ${best.mid}, gap ${best.len})`);
  }
}

const [cmd, only] = process.argv.slice(2);
if (cmd === "roll" && only) {
  const [lane, sub, seed] = only.split(":");
  try { await rollOne(lane, sub, Number(seed) || 1); }
  catch (e) { console.error("FAIL", only, e.message); process.exitCode = 1; }
} else if (cmd === "sheet") {
  sheet();
} else if (cmd === "fit") {
  const [, rollFile, outStem, artH] = process.argv.slice(2);
  fit(rollFile, outStem, Number(artH) || 246);
} else {
  console.log("usage: roll <lane>:<sub>:<seed> | sheet | fit <rollFile> <outStem> <artH>");
}
