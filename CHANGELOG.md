# Changelog

Every version that has gone live, newest first. The version lives in `shared/version.js` and every release is also a git tag (`git tag -n` is the short form of this file; `git show vX.Y.Z` inspects any release). Per the release procedure in CLAUDE.md, this file is updated in the same commit as the version bump — if a version is live, its entry is here.

## v0.1.19 — 2026-07-22

**The pet corner.** The feast's arm-wrestling pair is retired; where their table stood, every equipped pet now gathers on its own rug to play out the celebration:

- Cats groom — licking their flank clean, scrubbing behind an ear, sitting up smug between passes. Pups roll belly-up with paws paddling, then spring up tail-wagging. Drakelings puff little arcs of embers. Slimelets bounce, stretching tall mid-hop and splatting wide. Moon Owls turn their head clean around and hoot. Glimmer Wisps pulse and throw off orbiting shines.
- The corner has its own rug, water bowl, and ball of yarn; pets spread across it facing the middle, staggered in depth.
- `setupFeast` no longer assigns the wrestle pair — everyone joins the drink/eat/sing/dance rotation; the wrestle activity and its table are gone from both renderers.

## v0.1.18 — 2026-07-22

Boss level floor (balance stopgap): Kings now stat their HP and damage against `max(stage, highest level in the party)` instead of the raw stage, so boss fights stay real after the party outlevels the content (most visibly right after a chapter reset). Rewards still pay on the real stage; elites and normal packs are unchanged. A formal balance pass is planned; this holds the line until then.

## v0.1.17 — 2026-07-22

Smoothed the world scroll in the multiplayer client: the background now interpolates between server snapshots like the characters always did, instead of stepping forward at the 10Hz broadcast rate — the travel between fights no longer stutters.

## v0.1.16 — 2026-07-22

Flipped all four generated enemy sprites to face left, toward the party — the v0.1.15 sprites shipped facing away from the fight (the fit step's mirror was skipped). Asset-only fix; no code changes.

## v0.1.15 — 2026-07-22

**Generated enemies — the monsters join the diorama.** The four zone enemies are now PixelLab-generated sprites in the Star Renegades character lane (docs/ART-PIPELINE.md phase 6):

- The Verdant Fields slime, Gloomwood cave bat, Forgotten Crypt skeleton, and Emberdeep imp replace their procedural drawings via the new ENEMY_SPRITES registry (`assets/enemies/<kind>.png`); the procedural art remains the fallback (and the standalone prototype's look), and the Kings are the same sprites at boss scale with their procedural crown.
- Engine motion animates the static sprites — slime squash-and-stretch, bat hover with flap lift, skeleton and imp step-bob — and enraged enemies flush red. Elite auras, telegraphs, cleave rings, and HP bars stay procedural on top.
- New `scripts/art/fit-enemy.mjs` fits raw generations onto the P2 texel grid (trim → hard-alpha resample to exact texel height → 2× upscale → optional mirror).

## v0.1.14 — 2026-07-22

**The seam polish release — every layer boundary now reads natural.** A round of owner-driven refinements to how the generated layers meet:

- **Regenerated plates** — Emberdeep and Gloomwood backgrounds now carry texture to their bottom edge (their old "corner framing" produced flat bars at the ground seam).
- **The Crypt walks on a road** — the ashlar-block strip (which read as a wall face) is replaced by a worn cobbled path of irregular stones.
- **Gloomwood's floor is a deep-forest trail** — dense moss, roots, and stones with scattered luminous spore patches, replacing the featureless dark gradient.
- **Layer transitions** — strips lost their inpaint-artifact bottom row; the ground below the surface now smears smoothly to the frame edge instead of showing a second-pass seam; a depth-haze feather and an irregular palette-matched clump fringe (grass/moss/rubble/ember nubs per zone) break the ruler-straight line where the midground meets the ground.
- New dev tool: `prototype/biomes.html` renders all four biomes live on one page for art review.

## v0.1.13 — 2026-07-22

Removed the last flat transition band between the midground and the ground: each ground strip's blank top margin (a few near-uniform rows the generator left above the actual surface texture — most visible as a dark bar in Gloomwood) is now trimmed away, so surface texture starts exactly at the walk-surface lip in all four zones.

## v0.1.12 — 2026-07-22

**The ground got its perspective back.** All four ground strips regenerated from a slightly elevated camera — the walkable surface now reads as a foreshortened plane you look down onto (mottled meadow, mossy forest floor, flagstone paving, ember-veined crust) instead of an eye-level cross-section with grass silhouetted against the sky. The strip's surface lip was also raised to overlap the background plate's bottom edge, removing the flat single-color band that sat awkwardly between the midground and the ground.

## v0.1.11 — 2026-07-22

**Generated ground and planted props — the environment pass is complete.** Every layer of the scene (background, midground, ground) is now generated art with procedural fallback.

- **The ground the party walks on is real terrain** — seamlessly tiling generated strips scrolling underfoot: sunlit grass over root-laced earth (Verdant Fields), mossy spore-flecked soil (Gloomwood), worn flagstones over cracked masonry (Forgotten Crypt), charred basalt veined with glowing embers (Emberdeep). The scrolling tufts, ember sparks, and walking light pools still play on top.
- **Props no longer hover** — midground trees, rocks, flora, and fauna now bed into the ground lip (scaled so small critters aren't buried) and cast soft contact shadows, fixing the visible gap under irregular sprite bases.

## v0.1.10 — 2026-07-22

**A living, changing midground.** The second art-pipeline release: the repeating procedural props are replaced by varied generated prop sets.

- **Each zone now has a landscape, not a wallpaper** — a large anchor (oak, twisted glow-tree, candle pillar, lava spire) plus rocks, flora, and biome fauna: a rabbit in Verdant Fields, an owl on a stump in Gloomwood, a rat in the Forgotten Crypt, a fire salamander in Emberdeep. Placement varies as the party marches — different props, shifted positions, mirrored flips, open stretches — while staying deterministic, so every connected player sees the identical world.
- **Everything is scaled to the heroes** — fauna at ankle-to-knee height, flora knee-to-chest, anchor trees about twice a hero's height (the first draft's rabbit was taller than a human; the art bible now has a formal scale rule).
- Procedural props remain as automatic fallback, and the standalone prototype keeps its procedural look.

## v0.1.9 — 2026-07-21

**Generated background art and the Kitsune cosmetic set.** The first fruits of the new AI-assisted art pipeline (see docs/ART-PIPELINE.md).

- **Every scene has a painted backdrop** — all four zones (a sunlit pine valley for Verdant Fields, a glowing root-tunnel for Gloomwood, a moonlit vaulted colonnade for the Forgotten Crypt, a molten lava valley for Emberdeep) and the mead hall's timber wall are now pixel-art plates generated to each zone's palette, sitting under the engine's live sun, god rays, fog, and depth blur. Plates load from `assets/zones/` with the old procedural backgrounds as automatic fallback (the standalone prototype keeps the procedural look).
- **The Kitsune set** — five new cosmetics that compose into a fox-spirit hero: Kitsune Crown hairstyle (tapered fox ears with a star stud), Foxfire hair (the first two-tone dye, green fading to magenta), Fox Markings whisker stripes, the Nine-Tails cape (a fan of swaying pink-tipped tails), and the Starfire Aura (golden glow with rising star twinkles).
- New art-direction docs (ART-BIBLE.md, ART-PIPELINE.md, KITSUNE-CHARACTER.md) and dev tools: a cosmetic/biome preview harness (`qa-kitsune-preview.mjs` + `prototype/kitsune-preview.html`) and a kitsune render regression check (`qa-kitsune-set.mjs`).

## v0.1.8 — 2026-07-21

Fixed the "fast forward" burst after returning to a backgrounded tab: while hidden, snapshots kept queuing visual effects (floaters, particle bursts, screen shake, sounds) that the paused render loop never drained, so refocusing replayed the whole backlog at once. Effects are now skipped while the tab is hidden — the world state itself was always current — and a background tab is now fully silent, matching the music.

## v0.1.7 — 2026-07-21

Fixed the feast's arm-wrestling pair drawing their reach across the whole hall: the arm was anchored to the table while the wrestlers were still walking to it, stretching until they arrived. Wrestlers now walk with arms at their sides and only lock hands once seated (plus a sanity cap on arm length).

## v0.1.6 — 2026-07-21

**The prestige split: chapters end themselves, retelling is personal.** The party vote is gone.

- **Automatic chapter endings** — felling the stage-20 King (the fourth King, one full tour of the four zones) now ends the chapter on its own: the mead-hall feast plays, the guild earns a fixed 9 renown (× the chapter mutator's bonus), a Hall of Legends plaque is enshrined, a new mutator rolls, and the world resets to stage 1.
- **Heroes persist** — characters are no longer reset by the world. Levels, gear, and skills carry across chapters; shared gold persists; the feast tops potion stock up to the stipend baseline (never down).
- **Retell your Tale** — prestige is now each player's own choice: at level 21+ a hero can reset to level 1, converting their progress into `renownEarn(level)` × mutator renown for the shared guild pool. Owner-gated online; per-hero retelling counts are persisted and shown in the Guild Hall.
- The Guild Hall panel gained a chapter-progress box (stage X of 20) and per-member retell rows; the timeline's purple tome now marks the chapter finale; the chronicle counts tales retold anew.
- Migration note for worlds saved beyond stage 20 under the old rules: the chapter ends at the next multiple of 20 (a one-time renown windfall), then normalizes to 20-stage cycles.

## v0.1.5 — 2026-07-20

Removed the vestigial frame borders; the layout fits the viewport exactly with no scrollbar.

## v0.1.4 — 2026-07-20

Fixed the side-rail height caps so the rails account for the header and the page no longer scrolls.

## v0.1.3 — 2026-07-20

Viewport-filling layout: the frame fills the browser height with the world bar and tabs anchored at the bottom.

## v0.1.2 — 2026-07-20

The Guild Hall, Alchemist, and Chronicle tabs open as right-side panels, matching the character window.

## v0.1.1 — 2026-07-20

Header declutter: world state moved to a world bar under the canvas, and the Chorus of Courage indicator into the sidebar.

## v0.1.0 — 2026-07-20

First versioned release: the full production deployment. Discord bot presence + OAuth live, party sidebar, boss timeline rail, stats panel, auto-assigned skill points, boss spoils in the chronicle, split sfx/music toggles, and the player tutorial.
