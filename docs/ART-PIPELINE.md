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
5. **Phase 4 — next targets:** midground props (the flat procedural trees/posts are now the weakest layer), then enemies one at a time (PixelLab `create_character`), then inspect-portrait backdrops.

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
