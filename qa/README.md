# QA harnesses

Standalone checks and review harnesses, run by hand from the repo root. These are
distinct from `test/`, which holds the automated vitest suite (`npm test`) that
runs on every change. Nothing here is wired into `npm test`: these are the heavier
or human-judged checks you reach for when touching the systems they cover.

Every script resolves its own paths, so it runs correctly from any working
directory (`node qa/creator.mjs` and `cd qa && node creator.mjs` behave the same).

## Headless regressions — pass/fail, no eyes needed

| Script | Covers | Run |
|---|---|---|
| `creator.mjs` | Character creator: catalogs, `applyAppearance` validation, persistence round-trip, legacy backfill | `node qa/creator.mjs` |
| `chapter-retell.mjs` | Automatic chapter end and personal retellings | `node qa/chapter-retell.mjs` |
| `kitsune-set.mjs` | Kitsune HD cosmetic set renders | `node qa/kitsune-set.mjs` |
| `myth-set.mjs` | Phase 6 Myth cosmetics (Aurora Veil / Emberling / Starweave Mantle), combat + feast | `node qa/myth-set.mjs` |
| `ws-smoke.mjs` | Boots the real server, joins over WebSocket, checks every snapshot for renderable member fields and probes the connect-time race | `node qa/ws-smoke.mjs` |
| `render-soak.mjs` | Drives the sim through every visual scenario against the real `draw()` on a mocked 2D context | see below |

`ws-smoke.mjs` boots the server on port 8791 under `GUILD_ID=qa-smoke`; delete
`server/guild.db` afterward if you don't want the QA world lying around.

`render-soak.mjs` needs the renderer bundled first:

```bash
npx esbuild client/src/render.js --bundle --format=esm --outfile=/tmp/render.bundle.mjs --loader:.jsx=jsx --alias:@shared=./shared && node qa/render-soak.mjs
```

On Windows, node resolves `/tmp` to `C:\tmp` (which is *not* Git Bash's `/tmp`) —
if the import fails, that mismatch is why.

## Preview harnesses — generate a view, then look at it

These write a JSON view snapshot into `prototype/`, where the matching `.html`
harness fetches it. Serve that directory (`npx serve prototype`, or the
`art-preview` entry in `.claude/launch.json`) and open the page.

| Script | Writes | Open |
|---|---|---|
| `kitsune-preview.mjs` | `prototype/kitsune-view.json` | `/kitsune-preview.html`, or `/biomes.html` for all zones at once |
| `pet-preview.mjs` | `prototype/feast-pets-view.json` | `/pet-preview.html` |
| `crate-preview.mjs` | `prototype/crate-view.json` + the sprite pair | `/crate-preview.html` (`?mode=win\|dupe\|proc`, `?freeze=<s>`) |

`kitsune-preview.mjs` takes an optional argument: a stage number (6 = Gloomwood,
11 = Crypt, 16 = Emberdeep) or `feast` for the mead hall. The preview pages draw
with the real `render.js`, so they need the same bundle as the soak, copied to
`prototype/render.bundle.mjs`.

## Balance

`balance-sweep.mjs` is the measurement tool, aliased as `npm run sweep`. It drives
`scripts/balance/harness.mjs` over seeded, composition-forced runs (a fresh world
and a live-scale fixture) and writes a per-version baseline to
`docs/balance/baselines/`. Run it before and after **any** change to combat or
economy numbers and diff the JSON — that diff is the evidence.

```bash
npm run sweep                      # both fixtures, 3 chapters, seed 20260725
node qa/balance-sweep.mjs --fixture=live --chapters=5
node qa/balance-sweep.mjs --comps=trinity,solo-dps --seed=20260719
```
