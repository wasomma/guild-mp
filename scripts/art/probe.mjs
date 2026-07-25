// Pixel probe for T-pose sheet surgery: dump a region of a PNG as an
// index grid plus a colour legend, so edits can be authored on exact
// coordinates instead of eyeballed off a zoom.
//   node scripts/art/probe.mjs <file> <x> <y> <w> <h>
//   node scripts/art/probe.mjs <file> palette
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const [file, a, b, c, d] = process.argv.slice(2);
const png = PNG.sync.read(readFileSync(file));
const at = (x, y) => {
  const i = (y * png.width + x) << 2;
  return png.data[i + 3] < 8
    ? null
    : `#${[0, 1, 2].map((k) => png.data[i + k].toString(16).padStart(2, "0")).join("")}`;
};

if (a === "palette") {
  const hist = new Map();
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const h = at(x, y) ?? "transparent";
      hist.set(h, (hist.get(h) || 0) + 1);
    }
  [...hist].sort((p, q) => q[1] - p[1]).forEach(([h, n]) => console.log(h, n));
  console.log(`${png.width}x${png.height}, ${hist.size} colours`);
} else {
  const x0 = +a, y0 = +b, w = +c, h = +d;
  const glyphs = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const key = new Map();
  const rows = [];
  for (let y = y0; y < y0 + h; y++) {
    let row = "";
    for (let x = x0; x < x0 + w; x++) {
      const col = at(x, y);
      if (col === null) { row += "."; continue; }
      if (!key.has(col)) key.set(col, glyphs[key.size] ?? "?");
      row += key.get(col);
    }
    rows.push(String(y).padStart(4) + " " + row);
  }
  let ruler = "     ";
  for (let x = x0; x < x0 + w; x++) ruler += x % 10 === 0 ? "|" : x % 5 === 0 ? "+" : " ";
  console.log(ruler);
  rows.forEach((r) => console.log(r));
  console.log("     " + `x ${x0}..${x0 + w - 1}`);
  [...key].forEach(([col, g]) => console.log(` ${g} = ${col}`));
}
