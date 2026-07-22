// Generate a seamless horizontally-tileable ground strip via PixelLab:
// pixflux base -> roll half-width -> inpaint the seam band -> 3x upscale.
// Usage: node gen-ground.mjs <outPrefix> <seed> <paletteColorsCSV> "<description>"
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const [, , outPrefix, seedStr, palCSV, desc] = process.argv;
const W = 160, H = 23, KEY = process.env.PIXELLAB_SECRET;

const cols = palCSV.split(",");
const palPng = new PNG({ width: cols.length, height: 1 });
cols.forEach((h, i) => {
  palPng.data[i * 4] = parseInt(h.slice(1, 3), 16);
  palPng.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
  palPng.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
  palPng.data[i * 4 + 3] = 255;
});
const pal = PNG.sync.write(palPng).toString("base64");

async function call(path, body) {
  const r = await fetch("https://api.pixellab.ai/v1" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { console.log(path, "HTTP", r.status, (await r.text()).slice(0, 250)); process.exit(1); }
  const j = await r.json();
  return PNG.sync.read(Buffer.from(j.image.base64.replace(/^data:image\/png;base64,/, ""), "base64"));
}

const base = await call("/generate-image-pixflux", {
  description: desc,
  image_size: { width: W, height: H },
  view: "low top-down",
  shading: "detailed shading",
  detail: "highly detailed",
  outline: "lineless",
  text_guidance_scale: 8,
  color_image: { type: "base64", base64: pal },
  seed: Number(seedStr),
});

/* roll half-width so the tiling seam sits in the middle */
const rolled = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const sx = (x + W / 2) % W;
  for (let k = 0; k < 4; k++) rolled.data[(y * W + x) * 4 + k] = base.data[(y * W + sx) * 4 + k];
}

/* mask: white 28px band over the seam, black elsewhere */
const mask = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const v = Math.abs(x - W / 2) < 14 ? 255 : 0;
  const i = (y * W + x) * 4;
  mask.data[i] = mask.data[i + 1] = mask.data[i + 2] = v; mask.data[i + 3] = 255;
}

const fixed = await call("/inpaint", {
  description: desc,
  image_size: { width: W, height: H },
  inpainting_image: { type: "base64", base64: PNG.sync.write(rolled).toString("base64") },
  mask_image: { type: "base64", base64: PNG.sync.write(mask).toString("base64") },
  color_image: { type: "base64", base64: pal },
  view: "low top-down",
  shading: "detailed shading",
  detail: "highly detailed",
  outline: "lineless",
  seed: Number(seedStr) + 1,
});

writeFileSync(outPrefix + ".png", PNG.sync.write(fixed));
const dst = new PNG({ width: W * 3, height: H * 3 });
for (let y = 0; y < dst.height; y++) for (let x = 0; x < dst.width; x++) {
  const si = ((y / 3 | 0) * W + (x / 3 | 0)) * 4, di = (y * dst.width + x) * 4;
  for (let k = 0; k < 4; k++) dst.data[di + k] = fixed.data[si + k];
}
writeFileSync(outPrefix + "-3x.png", PNG.sync.write(dst));
console.log("SAVED", outPrefix, "(seamless, +3x " + dst.width + "x" + dst.height + ")");
