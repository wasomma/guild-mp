// Generate a background plate candidate via PixelLab pixflux.
// Usage: node gen-plate.mjs <outPrefix> <seed> <paletteColorsCSV> "<description>"
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const [, , outPrefix, seedStr, palCSV, desc] = process.argv;
const cols = palCSV.split(",");
const palPng = new PNG({ width: cols.length, height: 1 });
cols.forEach((h, i) => {
  palPng.data[i * 4] = parseInt(h.slice(1, 3), 16);
  palPng.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
  palPng.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
  palPng.data[i * 4 + 3] = 255;
});
const pal = PNG.sync.write(palPng).toString("base64");

const r = await fetch("https://api.pixellab.ai/v1/generate-image-pixflux", {
  method: "POST",
  headers: { Authorization: "Bearer " + process.env.PIXELLAB_SECRET + "", "Content-Type": "application/json" },
  body: JSON.stringify({
    description: desc,
    image_size: { width: 214, height: 100 },
    shading: "detailed shading",
    detail: "highly detailed",
    outline: "lineless",
    text_guidance_scale: 8,
    color_image: { type: "base64", base64: pal },
    seed: Number(seedStr),
  }),
});
if (!r.ok) { console.log(outPrefix, "HTTP", r.status, (await r.text()).slice(0, 250)); process.exit(1); }
const j = await r.json();
const src = PNG.sync.read(Buffer.from(j.image.base64.replace(/^data:image\/png;base64,/, ""), "base64"));
writeFileSync(outPrefix + ".png", PNG.sync.write(src));
const dst = new PNG({ width: 640, height: 300 });
for (let y = 0; y < 300; y++) for (let x = 0; x < 640; x++) {
  const sx = Math.min(src.width - 1, Math.floor((x + 1) / 3)), sy = Math.min(src.height - 1, Math.floor(y / 3));
  const si = (sy * src.width + sx) * 4, di = (y * 640 + x) * 4;
  for (let k = 0; k < 4; k++) dst.data[di + k] = src.data[si + k];
}
writeFileSync(outPrefix + "-3x.png", PNG.sync.write(dst));
console.log("SAVED", outPrefix, "(+3x)");
