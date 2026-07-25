// Nearest-neighbour zoom of a region, for eyeballing surgery targets.
//   node scripts/art/zoom.mjs <in> <out> <x> <y> <w> <h> [scale]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const [inF, outF, x0, y0, w, h, s] = process.argv.slice(2);
const S = Number(s) || 8;
const src = PNG.sync.read(readFileSync(inF));
const X = +x0, Y = +y0, W = +w, H = +h;
const dst = new PNG({ width: W * S, height: H * S });
for (let y = 0; y < dst.height; y++)
  for (let x = 0; x < dst.width; x++) {
    const sx = X + (x / S | 0), sy = Y + (y / S | 0);
    const si = (sy * src.width + sx) << 2, di = (y * dst.width + x) << 2;
    const inside = sx >= 0 && sy >= 0 && sx < src.width && sy < src.height;
    dst.data[di] = inside ? src.data[si] : 0;
    dst.data[di + 1] = inside ? src.data[si + 1] : 0;
    dst.data[di + 2] = inside ? src.data[si + 2] : 0;
    dst.data[di + 3] = inside ? src.data[si + 3] : 0;
    /* 10px grid: tint the first row/col of every tenth source pixel */
    if (inside && ((sx % 10 === 0 && x % S === 0) || (sy % 10 === 0 && y % S === 0))) {
      dst.data[di] = 255; dst.data[di + 1] = 0; dst.data[di + 2] = 0; dst.data[di + 3] = 255;
    }
  }
writeFileSync(outF, PNG.sync.write(dst));
console.log(`${outF}  src x${X}..${X + W - 1} y${Y}..${Y + H - 1} @${S}x (red grid every 10 src px)`);
