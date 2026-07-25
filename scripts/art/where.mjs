// Locate every connected cluster of a given colour: bbox + pixel count.
//   node scripts/art/where.mjs <file> <#rrggbb> [minSize]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const [file, want, minS] = process.argv.slice(2);
const MIN = Number(minS) || 1;
const png = PNG.sync.read(readFileSync(file));
const hex = (x, y) => {
  const i = (y * png.width + x) << 2;
  return png.data[i + 3] < 8 ? null
    : `#${[0, 1, 2].map((k) => png.data[i + k].toString(16).padStart(2, "0")).join("")}`;
};
const seen = new Uint8Array(png.width * png.height);
const out = [];
for (let y = 0; y < png.height; y++)
  for (let x = 0; x < png.width; x++) {
    if (seen[y * png.width + x] || hex(x, y) !== want) continue;
    let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
    const st = [[x, y]];
    seen[y * png.width + x] = 1;
    while (st.length) {
      const [cx, cy] = st.pop();
      n++;
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
      if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= png.width || ny >= png.height) continue;
        if (seen[ny * png.width + nx] || hex(nx, ny) !== want) continue;
        seen[ny * png.width + nx] = 1;
        st.push([nx, ny]);
      }
    }
    if (n >= MIN) out.push({ n, x0, y0, x1, y1 });
  }
out.sort((a, b) => b.n - a.n);
out.forEach((c) => console.log(`n=${String(c.n).padStart(5)}  x ${c.x0}..${c.x1}  y ${c.y0}..${c.y1}`));
console.log(`${out.length} clusters of ${want} (min ${MIN})`);
