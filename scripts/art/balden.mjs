// Head-repair pass: inpaint a rolled mannequin's haired head into a bald
// one (race features kept/added). The Phase 7D landmine — "bald" in an
// inpaint description beats any hair clause — is the mechanism, used
// deliberately. Usage:
//   node scripts/art/balden.mjs <rollName> <seed> "<head description>"
// e.g. node scripts/art/balden.mjs b235-elf-f-s3 1 "long elegant pointed elf ears extending out to the sides"
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { PNG } = require("pngjs");

const KEY = JSON.parse(readFileSync(homedir() + "/.claude.json", "utf8"))
  .mcpServers.pixellab.env.PIXELLAB_SECRET;
const DIR = "docs/art-src/heroes-d2";
const [name, seedArg, feature] = process.argv.slice(2);
const seed = Number(seedArg) || 1;

const src = PNG.sync.read(readFileSync(`${DIR}/${name}.png`));
const { width: W, height: H } = src;

/* mask: the head box — from the crown down past the chin, full width so
   hanging hair beside the shoulders is repaintable too */
const mask = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  const on = y <= 62;
  mask.data[i] = mask.data[i + 1] = mask.data[i + 2] = on ? 255 : 0;
  mask.data[i + 3] = 255;
}

const pal = ["#e8b98a", "#c99465", "#f6d4a6", "#3a3644", "#2a2732"];
const palB64 = (() => {
  const p = new PNG({ width: pal.length, height: 1 });
  pal.forEach((h, i) => {
    p.data[i * 4] = parseInt(h.slice(1, 3), 16);
    p.data[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
    p.data[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
    p.data[i * 4 + 3] = 255;
  });
  return PNG.sync.write(p).toString("base64");
})();

const r = await fetch("https://api.pixellab.ai/v1/inpaint", {
  method: "POST",
  headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    description: `completely bald head, no hair, smooth bare scalp, ${feature || "human head"}, soft gentle painterly face, calm slight smile, soft cel shading`,
    negative_description: "hair, hood, helmet, muddy, blurry, deformed",
    image_size: { width: W, height: H },
    inpainting_image: { type: "base64", base64: readFileSync(`${DIR}/${name}.png`).toString("base64") },
    mask_image: { type: "base64", base64: PNG.sync.write(mask).toString("base64") },
    color_image: { type: "base64", base64: palB64 },
    no_background: true,
    shading: "detailed shading", detail: "highly detailed", outline: "lineless",
    text_guidance_scale: 10,
    seed,
  }),
});
const j = await r.json().catch(() => null);
if (!r.ok) throw new Error("inpaint " + r.status + ": " + JSON.stringify(j).slice(0, 300));
writeFileSync(`${DIR}/${name}-bald-s${seed}.png`, Buffer.from(j.image.base64, "base64"));
console.log("wrote", `${DIR}/${name}-bald-s${seed}.png`, "usage", JSON.stringify(j.usage || {}));
