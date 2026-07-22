# Art-pipeline generators

The PixelLab generation scripts behind the v0.1.9–v0.1.14 art releases (recipes, prompt rules, and per-phase learnings live in `docs/ART-PIPELINE.md`).

Setup (once): `npm install pngjs` at the repo root, and set `PIXELLAB_SECRET` to the PixelLab API token (same value as the MCP server config; never commit it).

- `gen-plate.mjs <outPrefix> <seed> <paletteCSV> "<description>"` — 214×100 background plate + 3× upscale (640×300, P=3 grid). Palette CSV = hex colors forced via the API's `color_image`.
- `gen-prop.mjs <outPrefix> <seed> <paletteCSV> "<description>"` — transparent prop sprite (32×32 canvas via `PW`/`PH` env, auto-trimmed) + 3× upscale. Scale per the ART-BIBLE scale rule afterwards with `scale-prop.mjs`.
- `scale-prop.mjs <rawPng> <outPng> <texelFactor> [halve]` — trim + rescale a raw prop (fauna: `halve` + factor 2 for P2-density knee-height critters).
- `gen-ground.mjs <outPrefix> <seed> <paletteCSV> "<description>"` — seamless ground strip: 160×23 pixflux (`low top-down` view) → roll half-width → inpaint the seam → 3× upscale. Trim flat top rows and the artifact bottom row before shipping (per-row variance check — see ART-PIPELINE).
- `fit-enemy.mjs <rawPng> <outPng> <texelHeight> [flip]` — fit a raw enemy generation onto the P2 grid: trim, hard-alpha nearest resample to the exact texel height (slime 14, bat 17, skeleton/imp 29), 2× upscale, optional mirror (enemies must face LEFT). Enemy generation itself ran through the PixelLab MCP tools (no `color_image`/`seed` there — name hex colors in the prompt; see ART-PIPELINE phase 6).

Review the results in-game with `qa-kitsune-preview.mjs` (repo root) + `prototype/kitsune-preview.html`, or all biomes at once via `prototype/biomes.html`.
