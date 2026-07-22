// HD enemy generator (Phase B): pixflux via REST -> trim -> hard-alpha
// resample to exact art height (2 art px per logical unit, NO texel
// upscale) -> optional mirror to face LEFT. Run from the guild-mp root:
//   node gen-enemy-hd.mjs <kind> <seed>
// Raw roll saved to docs/art-src/enemies-hd/<kind>-s<seed>.png,
// fitted judge copy to prototype/enemy-hd-<kind>.png.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;

const CFG = {
  slime: {
    gen: { w: 64, h: 64 }, artH: 56, mirror: false,
    pal: ["#6fbf5e", "#4d8f45", "#3a6e37", "#a8e08c", "#d9f7c2", "#2e5c2a"],
    desc: "cute green slime monster blob, glossy translucent jelly body with a glowing pale core visible inside, side view facing left, bright vivid green #6fbf5e dominates, highlights #a8e08c, pale core #d9f7c2, dark green base #3a6e37, one droplet flying off",
    neg: "muddy, dark, brown, face, eyes",
  },
  bat: {
    gen: { w: 96, h: 80 }, artH: 68, mirror: false,
    pal: ["#5d4a7a", "#453563", "#2e2547", "#8a76ad", "#c9b8e8", "#e8e2d0", "#ffd76b"],
    desc: "cave bat monster in flight with wide spread webbed wings, side view facing left, fuzzy purple fur #5d4a7a, pale lavender wing membranes #8a76ad with #c9b8e8 highlights, small white fangs, glowing amber eyes #ffd76b, detailed fur texture",
    neg: "muddy, dark blob, bird feathers",
  },
  skeleton: {
    gen: { w: 64, h: 128 }, artH: 116, mirror: false,
    pal: ["#d8d3c0", "#f2eedd", "#b3ac94", "#8a8270", "#2a2440", "#7a5a3a"],
    desc: "skeleton warrior standing with a rusty short sword and a cracked round wooden shield, side view facing left, bright bone-white ivory #d8d3c0 dominates the sprite, bone highlights #f2eedd, dark eye sockets, detailed individual ribs and joints",
    neg: "dark bones, brown, muddy, flesh, skin",
  },
  imp: {
    gen: { w: 64, h: 128 }, artH: 116, mirror: false,
    pal: ["#c9503f", "#a03a2c", "#7a2a20", "#e87a55", "#f2c14e", "#3a1a16"],
    desc: "small horned imp demon walking in full side profile facing left, holding a trident, bright vivid brick-red skin #c9503f dominates the entire sprite, strong ember-orange belly and chest highlights #e87a55, well-lit, golden curved horns #f2c14e, pointed tail, mischievous fanged grin, detailed shading",
    neg: "muddy, dark, black silhouette",
  },
};

const [, , kind, seedArg] = process.argv;
const cfg = CFG[kind];
if (!cfg) throw new Error("kind must be one of: " + Object.keys(CFG).join(", "));
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
mkdirSync("docs/art-src/enemies-hd", { recursive: true });
writeFileSync(`docs/art-src/enemies-hd/${kind}-s${seed}.png`, PNG.sync.write(raw));

/* trim */
let x0 = raw.width, y0 = raw.height, x1 = -1, y1 = -1;
for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++)
  if (raw.data[(y * raw.width + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
const w = x1 - x0 + 1, h = y1 - y0 + 1;

/* hard-alpha nearest resample to exact art height */
const th = cfg.artH, tw = Math.max(1, Math.round((w / h) * th));
const out = new PNG({ width: tw, height: th });
for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
  const sxr = cfg.mirror ? tw - 1 - x : x;
  const sx = x0 + Math.min(w - 1, Math.floor(((sxr + 0.5) / tw) * w));
  const sy = y0 + Math.min(h - 1, Math.floor(((y + 0.5) / th) * h));
  const si = (sy * raw.width + sx) * 4, di = (y * tw + x) * 4;
  out.data[di] = raw.data[si]; out.data[di + 1] = raw.data[si + 1];
  out.data[di + 2] = raw.data[si + 2]; out.data[di + 3] = raw.data[si + 3] > 127 ? 255 : 0;
}
writeFileSync(`prototype/enemy-hd-${kind}.png`, PNG.sync.write(out));
console.log(kind, "seed", seed, ": raw", raw.width + "x" + raw.height,
  "trimmed", w + "x" + h, "-> fitted", tw + "x" + th,
  "usage", JSON.stringify(j.usage || {}));
