// Phase C hero-layer generator: pixflux via REST -> trim -> hard-alpha
// resample to exact art height. Run from the guild-mp root:
//   node gen-hero.mjs <part> <seed>     (part: body | tails)
// Raw saved to docs/art-src/kitsune-hd/<part>-s<seed>.png,
// fitted judge copy to prototype/kitsune-hd-<part>.png.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;

const CFG = {
  body: {
    gen: { w: 128, h: 256 }, artH: 246,
    pal: ["#5cc94a", "#3f9c38", "#e05aa8", "#f2c14e", "#722f42", "#c9973f", "#b24828", "#e8b98a", "#c99465", "#2a2430"],
    desc: "beautiful kitsune warrior woman standing in three-quarter view facing right, very long flowing green hair #5cc94a reaching her waist, fading to magenta-pink #e05aa8 at the tips, large fox ears with pink inner fur and a gold star stud, gold eyes, rust-red whisker markings #b24828 on her cheeks, fitted wine-red outfit #722f42 with gold trim #f2c14e and brass shoulder armor #c9973f, black leggings, brass armored boots, both hands clearly gripping a golden spear held at her side with well-drawn five-fingered hands, confident smile, detailed shading, no tail, tailless",
    neg: "muddy, dark, blurry, deformed hands, extra fingers, missing fingers, extra limbs, fox tail, tail, tail behind legs, animal tail",
  },
  tail: {
    gen: { w: 128, h: 64 }, artH: 56,
    pal: ["#5cc94a", "#3f9c38", "#2e7a2a", "#e05aa8"],
    desc: "one single fluffy bushy fox tail lying horizontally pointing left, gently curved, green fur #5cc94a covering most of the tail, only the leftmost tip quarter is magenta-pink #e05aa8, detailed soft fur texture, nothing else in frame",
    neg: "muddy, dark, multiple tails, body, animal, face, pink fur dominant, pink base",
  },
  tails: {
    gen: { w: 128, h: 128 }, artH: 120,
    pal: ["#5cc94a", "#3f9c38", "#2e7a2a", "#e05aa8", "#f2b8d8"],
    desc: "five separate bushy fox tails arranged in a fan, each tail long curved and fluffy, fur is green #5cc94a over most of each tail with ONLY the last quarter tip in magenta-pink #e05aa8, wide gaps of empty space between each tail, root points converging at the bottom right corner, nothing else in frame",
    neg: "muddy, dark, body, animal, face, legs",
  },
};

const [, , part, seedArg] = process.argv;
const cfg = CFG[part];
if (!cfg) throw new Error("part must be: " + Object.keys(CFG).join(" | "));
const seed = Number(seedArg) || 1;

const palPng = new PNG({ width: cfg.pal.length, height: 1 });
cfg.pal.forEach((h, i) => {
  palPng.data[i * 4] = parseInt(h.slice(1, 3), 16);
  palPng.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
  palPng.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
  palPng.data[i * 4 + 3] = 255;
});

const r = await fetch("https://api.pixellab.ai/v1/generate-image-pixflux", {
  method: "POST",
  headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    description: cfg.desc,
    negative_description: cfg.neg,
    image_size: { width: cfg.gen.w, height: cfg.gen.h },
    no_background: true,
    shading: "detailed shading",
    detail: "highly detailed",
    outline: "lineless",
    text_guidance_scale: 8,
    color_image: { type: "base64", base64: PNG.sync.write(palPng).toString("base64") },
    seed,
  }),
});
const j = await r.json();
if (!r.ok) throw new Error("pixflux HTTP " + r.status + ": " + JSON.stringify(j).slice(0, 500));
const raw = PNG.sync.read(Buffer.from(j.image.base64, "base64"));
mkdirSync("docs/art-src/kitsune-hd", { recursive: true });
writeFileSync(`docs/art-src/kitsune-hd/${part}-s${seed}.png`, PNG.sync.write(raw));

let x0 = raw.width, y0 = raw.height, x1 = -1, y1 = -1;
for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++)
  if (raw.data[(y * raw.width + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
const w = x1 - x0 + 1, h = y1 - y0 + 1;
const th = cfg.artH, tw = Math.max(1, Math.round((w / h) * th));
const out = new PNG({ width: tw, height: th });
for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
  const sx = x0 + Math.min(w - 1, Math.floor(((x + 0.5) / tw) * w));
  const sy = y0 + Math.min(h - 1, Math.floor(((y + 0.5) / th) * h));
  const si = (sy * raw.width + sx) * 4, di = (y * tw + x) * 4;
  out.data[di] = raw.data[si]; out.data[di + 1] = raw.data[si + 1];
  out.data[di + 2] = raw.data[si + 2]; out.data[di + 3] = raw.data[si + 3] > 127 ? 255 : 0;
}
writeFileSync(`prototype/kitsune-hd-${part}.png`, PNG.sync.write(out));
console.log(part, "seed", seed, ": raw", raw.width + "x" + raw.height,
  "trimmed", w + "x" + h, "-> fitted", tw + "x" + th,
  "usage", JSON.stringify(j.usage || {}));
