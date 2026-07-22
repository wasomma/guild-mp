// Generate a transparent midground prop sprite via PixelLab pixflux.
// Usage: node gen-prop.mjs <outPrefix> <seed> <paletteColorsCSV> "<description>"
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
    image_size: { width: Number(process.env.PW)||32, height: Number(process.env.PH)||50 },
    no_background: true,
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
const raw = PNG.sync.read(Buffer.from(j.image.base64.replace(/^data:image\/png;base64,/, ""), "base64"));
writeFileSync(outPrefix + ".png", PNG.sync.write(raw));
/* auto-trim transparent margins so each prop is its natural size */
let x0 = raw.width, y0 = raw.height, x1 = -1, y1 = -1;
for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) {
  if (raw.data[(y * raw.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
if (x1 < 0) { console.log(outPrefix, "EMPTY IMAGE"); process.exit(1); }
const src = new PNG({ width: x1 - x0 + 1, height: y1 - y0 + 1 });
for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
  const si = ((y + y0) * raw.width + (x + x0)) * 4, di = (y * src.width + x) * 4;
  for (let k = 0; k < 4; k++) src.data[di + k] = raw.data[si + k];
}
const dst = new PNG({ width: src.width * 3, height: src.height * 3 });
for (let y = 0; y < dst.height; y++) for (let x = 0; x < dst.width; x++) {
  const si = ((y / 3 | 0) * src.width + (x / 3 | 0)) * 4, di = (y * dst.width + x) * 4;
  for (let k = 0; k < 4; k++) dst.data[di + k] = src.data[si + k];
}
writeFileSync(outPrefix + "-3x.png", PNG.sync.write(dst));
console.log("SAVED", outPrefix, src.width + "x" + src.height, "(+3x)");
