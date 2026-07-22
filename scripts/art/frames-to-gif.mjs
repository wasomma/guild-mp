// Assemble canvas-captured PNG frames into a looping GIF.
// Usage: node frames-to-gif.mjs <framesJsonFile> <outGif> [delayMs]
// framesJsonFile: the javascript_tool overflow file — JSON [{type,text}] whose
// text is a JSON array of base64 PNG frames (no data: prefix).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const { GIFEncoder, quantize, applyPalette } = (await import("gifenc")).default;

const [, , inFile, outFile, delayStr] = process.argv;
const delay = Number(delayStr) || 80;
const outer = JSON.parse(readFileSync(inFile, "utf8"));
let frames = Array.isArray(outer) && outer[0] && outer[0].text !== undefined ? outer[0].text : outer;
while (typeof frames === "string") frames = JSON.parse(frames);
const gif = GIFEncoder();
for (const b64 of frames) {
  const png = PNG.sync.read(Buffer.from(b64, "base64"));
  const data = new Uint8ClampedArray(png.data);
  const palette = quantize(data, 256);
  const index = applyPalette(data, palette);
  gif.writeFrame(index, png.width, png.height, { palette, delay });
}
gif.finish();
writeFileSync(outFile, Buffer.from(gif.bytes()));
console.log(outFile, frames.length + " frames");
