# Art pipeline: the hybrid plan

Agreed direction (owner, 2026-07-21): **characters stay procedural** (the paperdoll — class × hair × outfit × weapon × cape × aura — makes static sprite sheets combinatorially explosive, and gear-visible-on-sprite is core to the reward loop). **Non-combinatorial art gets generated externally** via specialist pixel-art models, imported as assets.

## What gets generated vs. drawn in code

| Asset | Source | Why |
|---|---|---|
| Adventurer sprites, gear, weapons, capes, pets | Procedural (code) | Paperdoll combinatorics; rarity legibility |
| Zone backgrounds (4 zones × bg/mid layers) | Generated (PixelLab / Retro Diffusion) | Fixed count, biggest visual win |
| Enemies & the four Kings | Generated, candidate-by-candidate | Fixed appearances, no paperdoll problem |
| Guild hall / feast scene | Generated | One elaborate set piece |
| Inspect portraits | Procedural today; generated portrait *frames/backdrops* later | Portrait renders the live paperdoll |
| UI chrome, panel textures | Generated, low priority | — |

## Phases

1. **Phase 0 — scaffolding (done 2026-07-21):** ART-BIBLE.md skeleton, art-refs/ drop folder, this plan, PixelLab MCP setup instructions below.
2. **Phase 1 — style lock:** owner drops reference images in `docs/art-refs/`; Claude codifies concrete rules into ART-BIBLE.md; owner picks the pending character-fidelity study (procedural side keeps moving independently).
3. **Phase 2 — first generated asset, end to end (DONE 2026-07-21):** Verdant Fields background generated via the PixelLab REST API (`/generate-image-pixflux`, 214×100 → 3× nearest upscale onto the P=3 grid at 640×300, zone palette forced via `color_image`), wired into `drawScene` behind the `BG_PLATES`/`registerBgPlate` registry with procedural fallback, judged in-game via the preview harness. Asset: `client/public/assets/zones/verdant-fields.png`; provenance (all candidates, palette image, seeds in filenames' history) in `docs/art-src/verdant-fields/`. Learnings: prompt for light from the UPPER RIGHT (engine sun at x=552); reject candidates with a baked-in sun disc (engine draws its own); the API works with the MCP token via `Authorization: Bearer` even when the MCP tools aren't loaded.
4. **Phase 3 — backgrounds volume (DONE 2026-07-21):** all four zones + the feast hall have plates. Gloomwood = glowing root tunnel; Forgotten Crypt = vaulted colonnade lit from upper right; Emberdeep = lava-river valley (rejected: a candidate with a baked-in sun, and one that read as platformer ledges — background art must never read as walkable geometry); Feast Hall = plain timber wall plate hooked into `drawFeastBack` behind the animated windows/hearth/banner (over-stripped "no furniture no windows" prompts produce black voids — ask for "wall filling the entire frame, evenly lit"). All candidates in `docs/art-src/`; judged in-game per zone via `qa-kitsune-preview.mjs <stage|feast>` + the preview harness.
5. **Phase 4 — midground prop sets (DONE 2026-07-22):** each zone has a 4-sprite set (large anchor + rock + flora + biome fauna: rabbit/owl/rat/salamander) in `assets/props/<zone>-<slot>.png`, drawn by hash-of-world-tile placement (varied choice, ±jitter, flips, 1-in-5 empty tiles, small fillers between anchors — deterministic, identical on every client) via `PROP_SPRITES`/`registerPropSprite(zone, img, slot)`; procedural props remain the fallback. Learnings: the API floor is 32×32 — generate small props at 32×32 and auto-trim transparent margins; scale per the ART-BIBLE scale rule (the first rabbit shipped at 3× and towered over the party); force fur/feather colors into the palette or fauna comes out biome-tinted (lime-green rabbit).
6. **Phase 5 — ground strips + prop grounding (DONE 2026-07-22):** seamless horizontally-tileable ground strips for all four zones (`assets/ground/<zone>.png`, 480×69) via a new recipe: pixflux 160×23 → roll half-width so the tiling seam lands center → `/inpaint` the seam band (28px white mask) → 3× upscale. `GROUND_STRIPS`/`registerGroundStrip` replaces the flat color slabs; tufts, light pools, depth grade, and tilt-shift stay on top. Props also gained base-sinking (2–6px scaled by height) + contact-shadow ellipses after the owner flagged hovering bases — trimmed bounding boxes snap the lowest pixel to the line, but irregular bases need to bed in. Note: the inpaint endpoint caps at 200px wide; the pixflux free tier is 40 generations (exhausted mid-pass, owner added credits). **Perspective learning (v0.1.12):** ground strips must be generated with `view: "low top-down"` and prompted as a foreshortened surface plane with a flat top border — "side cross-section" prompts produce an eye-level view (grass silhouetted against the background) that breaks the game's implied elevated camera. The strip's main pass draws at GROUND−20 (8px above the old slab top) so the surface lip overlaps the plate's flat bottom band, with a bottom-aligned filler pass beneath. **No flat rows at the strip top (v0.1.13):** generators tend to leave a few near-uniform rows above the actual surface texture — measure per-row variance and trim them before shipping, or the blank margin reads as a color bar at the mid/ground seam (strip heights may differ per zone after trimming; the filler pass absorbs the difference).
7. **Phase 6 — next targets:** enemies one at a time, then inspect-portrait backdrops, feast-hall floor strip.

## Engine integration rules

- **Asset loader with procedural fallback.** `render.js` gains an image cache; every generated asset has the existing procedural drawing as its fallback when the image is missing/unloaded. The game must never break because an asset didn't ship.
- **The standalone-build wrinkle:** the prototype ships as ONE self-contained HTML file (claude.ai artifact + GitHub Pages). Generated assets must be **inlined as base64 data URIs** by `scripts/build-standalone.js` (or the prototype simply keeps procedural fallbacks — decide at Phase 2 based on file-size impact; the artifact has practical size limits).
- **Grid discipline:** generated images are authored at native resolution (e.g. a full bg layer at 640×300, props on the P=3 grid), *not* upscaled art. Post-process every generation: snap to grid, quantize to the zone ramp, kill AA edges. Retro Diffusion's [pixel-art-fixer](https://github.com/Retro-Diffusion/pixel-art-fixer) or a small script can do this.
- **The cardinal rule still applies:** any drawing-code change (including the asset-loader hooks) lands identically in `client/src/render.js` and `prototype/guild-idle.jsx`.
- Background layers get the engine's depth blur/tilt-shift/grade passes — author for post-processing, don't bake blur in.

## PixelLab MCP setup (owner action required)

1. Sign up at https://www.pixellab.ai and get an API token (interactive setup guide: https://www.pixellab.ai/vibe-coding).
2. Add the MCP server to Claude Code (run from the project you'll do art sessions in):

   ```
   claude mcp add pixellab -e PIXELLAB_SECRET=YOUR_TOKEN -- npx -y pixellab-mcp
   ```

   (Exact invocation per https://github.com/pixellab-code/pixellab-mcp — check its README if the package name changed.)
3. Tools exposed: `create_character`, `animate_character`, `create_tileset`, `create_isometric_tile`. For this project the tileset/tile tools and (for enemies) character generation are the relevant ones — party characters stay procedural.
4. Secondary option for backgrounds/stills: Retro Diffusion (https://retrodiffusion.ai/) has an API; script it if PixelLab's tileset orientation doesn't fit full-scene backgrounds.

## Visual iteration loop

- Art sessions require **seeing** the result: run the prototype (`npx serve prototype` or the standalone HTML) in the Claude browser pane. The pane must be **visible** — when hidden, the browser suspends requestAnimationFrame and the canvas stays blank.
- Claude captures pixels via screenshot or `canvas.toDataURL()` → PNG → visual inspection, then iterates against the ART-BIBLE.md checklist.
- Optional improvement: a headless Node renderer (node-canvas + DOM shim; `ctx.filter` blur must be shimmed to no-op) so soak scenarios export PNGs without a browser. Not required for the pipeline to work.
