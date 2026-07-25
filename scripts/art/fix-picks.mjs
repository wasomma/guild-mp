/* Deterministic pixel surgery on the owner's ten T-pose sheet picks.
   The sheets are otherwise good rolls, so feature defects are repaired in
   place rather than re-rolled (a re-roll is a different character, and the
   owner picked these). Only defects the model cannot be talked out of are
   handed to /inpaint (see fix-picks-ai.mjs); everything here is authored.

   Ops, all in source-pixel coordinates:
     clear   {x,y,w,h}                 -> flat card background
     recolor {x,y,w,h,from[],to}       -> palette swap inside a box
                                          interiorOnly: skip pixels touching
                                            background (protects silhouettes
                                            drawn in the erased colour)
                                          notTouching[]: skip pixels adjacent
                                            to these (keeps a garment's
                                            boundary line while clearing the
                                            seams drawn inside it)
     rim     {x,y,w,h,of,to}           -> shade the outer pixels of a colour
                                          region, so a recoloured garment
                                          still separates from the body
     heal    {x,y,w,h,from[]}          -> matching pixels take the colour of
                                          the nearest neighbour outside the
                                          match set (keeps local shading)
     stamp   {px:[[x,y,hex],...]}      -> explicit authored pixels

   Run: node scripts/art/fix-picks.mjs [label ...]      (default: all)
   Reads docs/art-src/heroes-d2/tpose/, writes .../tpose/fixed/. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const DIR = "docs/art-src/heroes-d2/tpose";
const OUT = `${DIR}/fixed`;

/* The sheets share one seven-colour ramp (the card background plus a
   five-step skin ramp and a linen tone), so these names hold for every
   pick even though the per-file palette order differs. */
const BG = "#ece2cd";
const SKIN_L = "#f6d4a6";   // lit skin
const SKIN_H = "#e8b98a";   // half tone
const SKIN_M = "#c99465";   // shadow
const SKIN_D = "#a87952";   // outline / deep shadow
const IVORY = "#efe6cf";    // canon tusk highlight (render.js drawRaceFace)
const IVORY_D = "#c9bfa4";  // canon tusk shade

/* Canon tusk (render.js:690): a short ivory pip jutting UP from the lower
   jaw, flanking the mouth, two texels tall with a shade pixel at its root.
   tusk(x, y) plants one with its root at (x, y), growing upward. */
const tusk = (x, y) => [
  [x, y, IVORY_D], [x + 1, y, IVORY_D],
  [x, y - 1, IVORY], [x + 1, y - 1, IVORY],
  [x, y - 2, IVORY],
];

/* An elf ear drawn as horizontal spans, tip row first, in the E-F1 idiom:
   dark rim on the outer edge, shadow on the inner edge against the skull,
   half-tone helix between them. Spans are [y, xInner, xOuter]; the caller
   sweeps them up-and-back so the pinna grows out of the existing nub
   instead of sprouting beside it. */
function elfEar(spans) {
  const px = [];
  spans.forEach(([y, xi, xo], row) => {
    for (let x = xi; x <= xo; x++) {
      px.push([x, y,
        row === 0 || x === xo ? SKIN_D : x === xi ? SKIN_M : SKIN_H]);
    }
  });
  return px;
}

/* Front view: root at the temple (x 84), tip swept up-and-back to (95,17).
   Back view: the same sweep off the skull's right edge. */
const EAR_FRONT = [
  [17, 94, 95], [18, 93, 95], [19, 92, 95], [20, 91, 94], [21, 90, 94],
  [22, 89, 93], [23, 88, 93], [24, 87, 92], [25, 86, 92], [26, 85, 91],
  [27, 85, 91], [28, 84, 90],
];
const EAR_BACK = [
  [18, 196, 197], [19, 195, 197], [20, 194, 197], [21, 193, 196],
  [22, 192, 196], [23, 191, 195], [24, 190, 195], [25, 189, 194],
  [26, 188, 193], [27, 187, 193], [28, 186, 192], [29, 185, 191],
];

const JOBS = {
  /* Garments read as streetwear — a dark brown tube top over denim-styled
     shorts with pocket curves and a fly seam — instead of the sheet's linen
     undergarments. Four /inpaint seeds over the chest and hip zones all came
     back with shapeless bands and smeared cloth (worse than the crisp roll),
     so this is authored: recolour the bandeau to linen and strip the seams
     drawn INSIDE the shorts while keeping the line where cloth meets skin. */
  "K-F2": {
    src: "px-kitsunekin-f-s8.png", out: "K-F2.png",
    ops: [
      /* bandeau: brown -> the same cream the other sheets' underwear wears,
         with a shaded rim so it still reads as cloth over a body */
      { op: "recolor", x: 52, y: 78, w: 36, h: 22, from: [SKIN_D], to: BG },
      { op: "rim", x: 52, y: 78, w: 36, h: 22, of: BG, to: "#aea28c" },
      /* The roll drew the band on the front view only, leaving the back bare
         — impossible once these become the front and back layers of one
         character. Wrap the band around: fill the torso's own cross-section
         (arms sit outside x 173..197 at these rows) and rim it to match. */
      { op: "band", cx: 185, y: 79, h: 20, maxHalf: 16, to: BG },
      { op: "rim", x: 165, y: 78, w: 42, h: 22, of: BG, to: "#aea28c" },
      /* The pocket/fly seams are deliberately LEFT ALONE: stripping them
         means recolouring lines drawn in the same hex as both the cloth and
         the card, which dissolved the hip silhouette in testing, and at the
         fitted hero height they are a pixel of texture. The colour change is
         what carries the read from streetwear to underwear. */
    ],
  },

  /* Blush dots on both cheeks read as make-up under a bald head. */
  "K-M1": {
    src: "px-kitsunekin-m-s7.png", out: "K-M1.png",
    ops: [
      { op: "recolor", x: 55, y: 55, w: 6, h: 6, from: [SKIN_M], to: SKIN_L },
      { op: "recolor", x: 72, y: 54, w: 9, h: 8, from: [SKIN_M], to: SKIN_L },
    ],
  },

  /* Hallucinated palette legend + caption text in the top-left corner.
     Nothing of the figure lives left of x=53 or above y=51. */
  "O-F3": {
    src: "px-orc-f-s4.png", out: "O-F3.png",
    ops: [
      { op: "clear", x: 0, y: 0, w: 53, h: 51 },
      /* Tusks hang off the cheeks like pendants: erase, replant at the
         mouth corners (mouth spans x 75..82 at y 37..40). */
      { op: "heal", x: 68, y: 32, w: 7, h: 10, from: [BG, "#f6d4a6", "#aea28c", "#d9cbb0"] },
      { op: "heal", x: 82, y: 32, w: 8, h: 10, from: [BG, "#f6d4a6", "#aea28c", "#d9cbb0"] },
      /* The roll's pale mouth band would fuse with the new tusks into one
         row of teeth — clear it first so the two pips read separately. */
      { op: "heal", x: 73, y: 38, w: 11, h: 4, from: [BG, "#d9cbb0", "#aea28c"] },
      { op: "stamp", px: [...tusk(74, 40), ...tusk(80, 40)] },
    ],
  },

  /* Tusks drawn as pale streaks running DOWN the cheeks from the eyes. */
  "O-M1": {
    src: "px-orc-m-s1.png", out: "O-M1.png",
    ops: [
      { op: "heal", x: 62, y: 36, w: 5, h: 13, from: [BG, "#f6d4a6", "#aea28c"] },
      { op: "heal", x: 74, y: 36, w: 5, h: 13, from: [BG, "#f6d4a6", "#aea28c"] },
      { op: "stamp", px: [...tusk(65, 45), ...tusk(72, 45)] },
    ],
  },

  /* A dark mole/scar blotch on the cheek — not a race feature, and it would
     read as damage at hero scale. (The gray hair goes to /inpaint.) */
  /* Also carries a baked gray crop. Bases must be bald — hairstyles are
     runtime-tinted overlay layers, so any baked hair shows under every
     style. The crop is painted tight to the skull rather than adding
     volume, so healing the gray to neighbouring skin bal-dens it without
     touching the silhouette or re-rolling the face through /inpaint. */
  "D-M3": {
    src: "px-dwarf-m-s1.png", out: "D-M3.png",
    ops: [
      { op: "recolor", x: 65, y: 31, w: 7, h: 8, from: [SKIN_D, SKIN_M], to: SKIN_L },
      /* Recolour rather than heal: healing lets the nearest neighbour win,
         and on the back of a skull that neighbour is the outline, which
         floods the crown brown. Each sheet has one dominant skin tone —
         paint the scalp with it (D-M3's is the lit tone). */
      { op: "recolor", x: 54, y: 11, w: 29, h: 20, from: ["#aea28c"], to: SKIN_L },
      { op: "recolor", x: 172, y: 11, w: 34, h: 27, from: ["#aea28c"], to: SKIN_L },
      /* The crop's dark strands survive the gray swap as speckle; clear
         them inside the scalp only, so the skull outline stays drawn. */
      { op: "recolor", x: 176, y: 12, w: 21, h: 19, from: [SKIN_D], to: SKIN_L, interiorOnly: true },
    ],
  },

  /* Same baked-crop problem, plus its highlight tone. Ears already have the
     house sweep, so only the scalp is touched. */
  "E-F1": {
    src: "px-elf-f-s1.png", out: "E-F1.png",
    ops: [
      { op: "recolor", x: 58, y: 12, w: 28, h: 21, from: ["#aea28c", "#d9cbb0"], to: SKIN_H },
      { op: "recolor", x: 168, y: 12, w: 29, h: 25, from: ["#aea28c", "#d9cbb0"], to: SKIN_H },
    ],
  },

  /* The back skull carries a desaturated gray wedge that reads as stubble
     at hero scale, over a skull interior painted in the card's own cream.
     Erasing the gray outright (first attempt) left a flat white cap on the
     cast sheet — so recolour instead: the wedge becomes a warm skin shadow
     and the cream dome becomes lit skin, keeping the modelling. */
  "D-F2": {
    src: "px-dwarf-f-s8.png", out: "D-F2.png",
    ops: [
      { op: "recolor", x: 168, y: 8, w: 36, h: 31, from: [BG], to: SKIN_L, insideOnly: true },
      { op: "recolor", x: 172, y: 20, w: 18, h: 18, from: ["#aea28c"], to: SKIN_M },
    ],
  },

  /* Ears are small nubs; the owner wants them pronounced (E-F1's swept
     ears are the house shape). Extend both views' tips. */
  "E-M1": {
    src: "px-elf-m-s4.png", out: "E-M1.png",
    ops: [
      { op: "stamp", px: elfEar(EAR_FRONT) },
      { op: "stamp", px: elfEar(EAR_BACK) },
    ],
  },
};

const hexAt = (p, x, y) => {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return null;
  const i = (y * p.width + x) << 2;
  return p.data[i + 3] < 8 ? null
    : `#${[0, 1, 2].map((k) => p.data[i + k].toString(16).padStart(2, "0")).join("")}`;
};
const setAt = (p, x, y, hex) => {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
  const i = (y * p.width + x) << 2;
  p.data[i] = parseInt(hex.slice(1, 3), 16);
  p.data[i + 1] = parseInt(hex.slice(3, 5), 16);
  p.data[i + 2] = parseInt(hex.slice(5, 7), 16);
  p.data[i + 3] = 255;
};

/* The garments are painted in the card background's own hex, so "is this
   pixel background?" cannot be answered by colour. Flood-fill the background
   in from the border: what it reaches is OUTSIDE the figure, what it misses
   (an enclosed cream garment) is cloth. */
function outsideOf(p) {
  const out = new Uint8Array(p.width * p.height);
  const st = [];
  for (let x = 0; x < p.width; x++) st.push([x, 0], [x, p.height - 1]);
  for (let y = 0; y < p.height; y++) st.push([0, y], [p.width - 1, y]);
  while (st.length) {
    const [x, y] = st.pop();
    if (x < 0 || y < 0 || x >= p.width || y >= p.height) continue;
    if (out[y * p.width + x]) continue;
    const h = hexAt(p, x, y);
    if (h !== null && h !== BG) continue;
    out[y * p.width + x] = 1;
    st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return out;
}

function run(label) {
  const job = JOBS[label];
  const png = PNG.sync.read(readFileSync(`${DIR}/${job.src}`));
  let outside = outsideOf(png);
  const isOut = (x, y) =>
    x < 0 || y < 0 || x >= png.width || y >= png.height || !!outside[y * png.width + x];
  for (const o of job.ops) {
    if (o.op === "clear") {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) setAt(png, x, y, BG);
    } else if (o.op === "recolor") {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) {
          if (!o.from.includes(hexAt(png, x, y))) continue;
          /* interiorOnly protects a silhouette drawn in the same colour as
             the thing being erased (scalp strands vs the head outline) */
          if (o.interiorOnly) {
            let edge = false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
              if (isOut(x + dx, y + dy)) { edge = true; break; }
            if (edge) continue;
          }
          if (o.insideOnly && isOut(x, y)) continue;
          if (o.notTouching) {
            let touches = false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
              if (o.notTouching.includes(hexAt(png, x + dx, y + dy))) { touches = true; break; }
            if (touches) continue;
          }
          setAt(png, x, y, o.to);
        }
    } else if (o.op === "band") {
      /* A garment band must follow the torso, not a bounding box — walk out
         from the spine on each row until the body ends (the arms hang past a
         background gap, so they are never reached; maxHalf is the guard for
         a row where an arm touches). */
      for (let y = o.y; y < o.y + o.h; y++) {
        let l = o.cx, r = o.cx;
        while (l - 1 >= 0 && !isOut(l - 1, y) && o.cx - l < o.maxHalf) l--;
        while (r + 1 < png.width && !isOut(r + 1, y) && r - o.cx < o.maxHalf) r++;
        for (let x = l; x <= r; x++) setAt(png, x, y, o.to);
      }
    } else if (o.op === "rim") {
      const edge = [];
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) {
          if (hexAt(png, x, y) !== o.of || isOut(x, y)) continue;
          /* cloth painted in the background's hex sits against background of
             the same hex, so "different colour" alone never finds the
             silhouette — being next to the OUTSIDE counts as an edge too */
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            if (hexAt(png, x + dx, y + dy) !== o.of || isOut(x + dx, y + dy)) {
              edge.push([x, y]); break;
            }
        }
      for (const [x, y] of edge) setAt(png, x, y, o.to);
    } else if (o.op === "heal") {
      /* Snapshot first so healed pixels can't seed further heals. */
      const before = Buffer.from(png.data);
      const snap = { width: png.width, height: png.height, data: before };
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) {
          const cur = hexAt(snap, x, y);
          if (!o.from.includes(cur)) continue;
          let rep = null;
          for (let r = 1; r < 24 && !rep; r++)
            for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
              const h = hexAt(snap, x + dx, y + dy);
              if (h && h !== BG && !o.from.includes(h)) { rep = h; break; }
            }
          if (rep) setAt(png, x, y, rep);
        }
    } else if (o.op === "stamp") {
      for (const [x, y, hex] of o.px) setAt(png, x, y, hex);
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${job.out}`, PNG.sync.write(png));
  console.log(`${label}  ${job.src} -> fixed/${job.out}  (${job.ops.length} ops)`);
}

const want = process.argv.slice(2);
for (const label of want.length ? want : Object.keys(JOBS)) run(label);
